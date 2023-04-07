/*
Backend server side part of ChatGPT integration with CoCalc.
*/

import getPool from "@cocalc/database/pool";
import getLogger from "@cocalc/backend/logger";
import { getServerSettings } from "@cocalc/server/settings/server-settings";
import computeHash from "@cocalc/util/jupyter-api/compute-hash";
import getOneProject from "@cocalc/server/projects/get-one";
import callProject from "@cocalc/server/projects/call";
import { jupyter_execute } from "@cocalc/util/message";
import { isValidUUID } from "@cocalc/util/misc";
import isCollaborator from "@cocalc/server/projects/is-collaborator";
import checkForAbuse from "./abuse";

const log = getLogger("jupyter-api:execute");

async function getConfig() {
  log.debug("get config");
  const { jupyter_account_id, jupyter_api_enabled } = await getServerSettings();

  return {
    jupyter_account_id,
    jupyter_api_enabled,
  };
}

interface Options {
  input?: string; // new input that user types
  kernel?: string;
  history?: string[];
  hash?: string;
  account_id?: string;
  analytics_cookie?: string;
  tag?: string;
  noCache?: boolean;
  project_id?: string;
  path?: string;
}

export async function execute({
  hash,
  input,
  kernel,
  account_id,
  analytics_cookie,
  history,
  tag,
  noCache,
  project_id,
  path,
}: Options): Promise<{
  output: object[];
  created: Date;
} | null> {
  // TODO -- await checkForAbuse({ account_id, analytics_cookie });

  log.debug("execute", {
    input,
    kernel,
    history,
    hash,
    account_id,
    analytics_cookie,
    tag,
    project_id,
    path,
  });

  // If hash is given, we only check if output is in database, and
  // if so return it.  Otherwise, return nothing.
  if (hash != null && !noCache) {
    return await getFromDatabase(hash);
  }
  if (input == null) {
    throw Error("input or hash must not be null");
  }
  if (kernel == null) {
    throw Error("kernel must be specified in hash is not specified");
  }

  const created = new Date();

  hash = computeHash({ history, input, kernel, project_id, path });

  if (!noCache) {
    // Check if we already have this execution history in the database:
    const savedOutput = await getFromDatabase(hash);
    if (savedOutput != null) {
      log.debug("got saved output");
      return savedOutput;
    }
    log.debug("have to compute output");
  }

  // Execute the code.
  let request_account_id, request_project_id;
  if (project_id == null) {
    const { jupyter_account_id, jupyter_api_enabled } = await getConfig();
    if (!jupyter_api_enabled) {
      throw Error("Jupyter API is not enabled on this server.");
    }
    if (!jupyter_account_id) {
      throw Error(
        "Jupyter API must be configured with an account_id that owns the compute project pool."
      );
    }
    request_account_id = jupyter_account_id;

    if (!isValidUUID(jupyter_account_id)) {
      throw Error("Jupyter API account_id is not a valid uuid.");
    }

    // we only worry about abuse against the general public pool, not when used in a user's own project
    await checkForAbuse({ account_id, analytics_cookie });
    request_project_id = (await getOneProject(jupyter_account_id)).project_id;
  } else {
    request_project_id = project_id;
    // both project_id and account_id must be set and account_id must be a collab
    if (account_id == null) {
      throw Error("account_id must be specified");
    }
    if (!isCollaborator({ project_id, account_id })) {
      throw Error("permission denied -- user must be collaborator on project");
    }
    request_account_id = account_id;
  }

  const mesg = jupyter_execute({ input, history, kernel, path });
  const resp = await callProject({
    account_id: request_account_id,
    project_id: request_project_id,
    mesg,
  });
  if (resp.error) {
    throw Error(resp.error);
  }
  const { output } = resp;
  log.debug("output", output);
  const total_time_s = (Date.now() - created.valueOf()) / 1000;
  saveResponse({
    created,
    input,
    output,
    kernel,
    account_id,
    project_id,
    path,
    analytics_cookie,
    history,
    tag,
    total_time_s,
    hash,
    noCache,
  });
  return { output, created };
}

// We just assume that hash conflicts don't happen for our purposes here.  It's a cryptographic hash function.
async function getFromDatabase(
  hash: string
): Promise<{ output: object[]; created: Date } | null> {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT id, output, created FROM jupyter_api_cache WHERE hash=$1`,
      [hash]
    );
    if (rows.length == 0) {
      return null;
    }
    // cache hit -- we also update last_active (nonblocking, nonfatal)
    (async () => {
      try {
        await pool.query(
          "UPDATE jupyter_api_cache SET last_active=NOW() WHERE id=$1",
          [rows[0].id]
        );
      } catch (err) {
        log.warn("Failed updating cache last_active", err);
      }
    })();
    return rows[0];
  } catch (err) {
    log.warn("Failed to query database cache", err);
    return null;
  }
}

// Save mainly for analytics, metering, and to generally see how (or if)
// people use chatgpt in cocalc.
// Also, we could dedup identical inputs (?).
async function saveResponse({
  created,
  input,
  output,
  kernel,
  account_id,
  project_id,
  path,
  analytics_cookie,
  history,
  tag,
  total_time_s,
  hash,
  noCache,
}) {
  const pool = getPool();
  if (noCache) {
    await pool.query("DELETE FROM jupyter_api_cache WHERE hash=$1", [hash]);
  }
  try {
    await Promise.all([
      pool.query(
        `INSERT INTO jupyter_api_log(created,account_id,project_id,path,analytics_cookie,tag,hash,total_time_s,kernel,history,input) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          created,
          account_id,
          project_id,
          path,
          analytics_cookie,
          tag,
          hash,
          total_time_s,
          kernel,
          history,
          input,
        ]
      ),
      pool.query(
        `INSERT INTO jupyter_api_cache(created,hash,output,last_active) VALUES($1,$2,$3,$4)`,
        [created, hash, output, created]
      ),
    ]);
  } catch (err) {
    log.warn("Failed to save Jupyter execute log entry to database:", err);
  }
}
