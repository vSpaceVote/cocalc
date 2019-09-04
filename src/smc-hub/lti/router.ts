import * as express from "express";
import * as uuid from "uuid";
import * as querystring from "querystring";
import * as jwt from "jsonwebtoken";
import * as jwksClient from "jwks-rsa";
import * as path from "path";
import { compute_global_user_id } from "./helpers";
import { get_iss_data, get_user } from "./db-operations";

import { inspect } from "util";

import { PostgreSQL } from "../postgres/types";

import {
  LoginInitiationFromPlatform,
  AuthRequestTokenData,
  PlatformResponse
} from "./types";

import * as auth_manager from "./auth-manager";

const SMC_ROOT: string = process.env.SMC_ROOT as any;
const STATIC_PATH = path.join(SMC_ROOT, "static");
const JWT_OPTIONS = { algorithms: ["RS256"] };

export function init_LTI_router(opts: {
  base_url: string;
  database: PostgreSQL;
}): express.Router {
  const router = express.Router();
  router.use(express.json());
  router.use(express.urlencoded({ extended: true }));

  router.route("/").all(function(_, res) {
    res.sendFile(path.join(STATIC_PATH, "lti.html"), { maxAge: 0 });
  });

  // https://www.imsglobal.org/spec/security/v1p0/#openid_connect_launch_flow
  // 5.1.1
  router.route("/login").all((req, res) => {
    const token: LoginInitiationFromPlatform = req.body;
    const iss_data = get_iss_data(opts.database, token.iss);
    const nonce = uuid.v4();
    const state = uuid.v4();

    const auth_params: AuthRequestTokenData = {
      scope: "openid",
      response_type: "id_token",
      response_mode: "form_post",
      prompt: "none",
      client_id: iss_data.client_id,
      redirect_uri: token.target_link_uri,
      login_hint: token.login_hint,
      state: state,
      nonce: nonce,
      lti_message_hint: token.lti_message_hint,
      id_token_hint: token.lti_message_hint
    };
    auth_manager.begin_auth_flow(state, { auth_params, iss_data });
    const query_string = querystring.stringify(auth_params);
    res.redirect(iss_data.auth_url + "?" + query_string);
  });

  // Tool Launch URL
  router.route("/launch*").all((req, res) => {
    console.log("\nLTI: Launch\n");
    if (req.body.error) {
      res.send(`Recieved error ${req.body.error}`);
    }
    const details = auth_manager.get_auth_flow(req.body.state);

    jwt.verify(
      req.body.id_token,
      getKey(details.iss_data.jwk_url),
      JWT_OPTIONS,
      function(err, token: PlatformResponse) {
        if (err) {
          res.send("Error parsing jwt:" + err);
        }
        const user_id = get_user(opts.database, compute_global_user_id(token));
        res.send(
          `Our id of this user: ${user_id} ------- ${inspect(
            details
          )} ------- `
        );
      }
    );
  });

  router.route("/deep-link-select").all((req, res) => {
    if (req.body.error) {
      res.send(`Recieved error ${req.body.error}`);
    }
    const token = jwt.decode(req.body.token_id, JWT_OPTIONS);
    const user_id = get_user(opts.database, token);
    const query_string = querystring.stringify({
      id_token: req.body.id_token,
      nonce: req.body.state,
      return_path: "lti/return-deep-link/",
      user_id
    });
    res.redirect("../lti?" + query_string);
  });

  router.post("/return-deep-link", (req, res) => {
    console.log("\nreturn-deep-link\n");
    if (req.body.error) {
      res.send(`Recieved error ${req.body.error}`);
    }
    const details = auth_manager.get_auth_flow(req.body.nonce);
    jwt.verify(
      req.body.id_token,
      getKey(details.iss_data.jwk_url),
      JWT_OPTIONS,
      function(err, token: PlatformResponse) {
        if (err) {
          res.send("Error parsing jwt:" + err);
        }
        const { assignment_name } = req.body;

        // `/launch` receives this url as target
        let url = `https://cocalc.com/${
          opts.base_url
        }/api/lti/launch/${uuid.v4()}`;

        // https://www.imsglobal.org/spec/security/v1p0/#step-2-authentication-request
        const nonce = uuid.v4();
        const redirect_url =
          token[
            "https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings"
          ].deep_link_return_url;
        const iss_data = get_iss_data(opts.database, token.iss);

        // https://www.imsglobal.org/spec/security/v1p0/#step-2-authentication-request
        const jwt_data = {
          iss: iss_data.client_id,
          aud: [token.iss],
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 60 * 60,
          nonce: nonce,
          header: {
            typ: "JWT",
            alg: "RS256"
          },
          "https://purl.imsglobal.org/spec/lti/claim/message_type":
            "LtiDeepLinkingResponse",
          "https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",
          "https://purl.imsglobal.org/spec/lti/claim/deployment_id":
            token["https://purl.imsglobal.org/spec/lti/claim/deployment_id"],
          "https://purl.imsglobal.org/spec/lti-dl/claim/data":
            token[
              "https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings"
            ],
          "https://purl.imsglobal.org/spec/lti-dl/claim/content_items": [
            {
              type: "ltiResourceLink", // TODO: What types are available?
              title: `${assignment_name}`,
              url: `${url}`
            }
          ] // Array of returned items (possibly empty)
        };

        const deep_link_response_token = jwt.sign(
          jwt_data,
          auth_manager.get_private_key(),
          JWT_OPTIONS
        );

        const formatted_token = { JWT: deep_link_response_token };
        const query_string = querystring.stringify(formatted_token);
        res.redirect(redirect_url + "&" + query_string);
      }
    );
  });

  return router;
}

function getKey(uri) {
  const jwkClient = jwksClient({
    jwksUri: uri
  });

  return (header, callback) => {
    jwkClient.getSigningKey(header.kid, function(_, key) {
      var signingKey = (key as any).publicKey || (key as any).rsaPublicKey;
      callback(null, signingKey);
    });
  };
}
