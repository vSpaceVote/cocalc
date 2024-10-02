import { Button, Flex, Space, Tooltip } from "antd";
import { CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import {
  redux,
  useActions,
  useRedux,
  useTypedRedux,
} from "@cocalc/frontend/app-framework";
import { AddCollaborators } from "@cocalc/frontend/collaborators";
import { A, Icon, Loading } from "@cocalc/frontend/components";
import { IS_MOBILE } from "@cocalc/frontend/feature";
import { ProjectUsers } from "@cocalc/frontend/projects/project-users";
import { user_activity } from "@cocalc/frontend/tracker";
import type { ChatActions } from "./actions";
import { ChatLog } from "./chat-log";
import ChatInput from "./input";
import { LLMCostEstimationChat } from "./llm-cost-estimation";
import { SubmitMentionsFn } from "./types";
import { INPUT_HEIGHT, markChatAsReadIfUnseen } from "./utils";
import VideoChatButton from "./video/launch-button";
import { COLORS } from "@cocalc/util/theme";
import Filter from "./filter";

interface Props {
  project_id: string;
  path: string;
  style?: CSSProperties;
  fontSize?: number;
}

export default function SideChat({
  project_id,
  path,
  style,
  fontSize,
}: Props) {
  const actions: ChatActions = useActions(project_id, path);
  const messages = useRedux(["messages"], project_id, path);
  const [lastVisible, setLastVisible] = useState<Date | null>(null);
  const input: string = useRedux(["input"], project_id, path);
  const search: string = useRedux(["search"], project_id, path);
  const addCollab: boolean = useRedux(["add_collab"], project_id, path);
  const is_uploading = useRedux(["is_uploading"], project_id, path);
  const project_map = useTypedRedux("projects", "project_map");
  const llm_cost_room: [number, number] = useRedux(
    ["llm_cost_room"],
    project_id,
    path,
  );
  const project = project_map?.get(project_id);
  const scrollToBottomRef = useRef<any>(null);
  const submitMentionsRef = useRef<SubmitMentionsFn>();

  const markAsRead = useCallback(() => {
    markChatAsReadIfUnseen(project_id, path);
  }, [project_id, path]);

  // The act of opening/displaying the chat marks it as seen...
  // since this happens when the user shows it.
  useEffect(() => {
    markAsRead();
  }, []);

  const sendChat = useCallback(
    (options?) => {
      const input = submitMentionsRef.current?.();
      actions.send_chat({ input, ...options });
      actions.delete_draft(0);
      scrollToBottomRef.current?.(true);
      setTimeout(() => {
        scrollToBottomRef.current?.(true);
      }, 10);
      setTimeout(() => {
        scrollToBottomRef.current?.(true);
      }, 1000);
    },
    [actions],
  );

  if (messages == null) {
    return <Loading />;
  }

  // WARNING: making autofocus true would interfere with chat and terminals
  // -- where chat and terminal are both focused at same time sometimes
  // (esp on firefox).

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#efefef",
        ...style,
      }}
      onMouseMove={markAsRead}
      onFocus={() => {
        // Remove any active key handler that is next to this side chat.
        // E.g, this is critical for taks lists...
        redux.getActions("page").erase_active_key_handler();
      }}
    >
      {!IS_MOBILE && project != null && actions != null && (
        <div
          style={{
            margin: "0 5px",
            paddingTop: "5px",
            maxHeight: "50vh",
            overflow: "auto",
            borderBottom: "1px solid lightgrey",
          }}
        >
          <Space.Compact
            style={{
              float: "right",
              marginTop: "-5px",
            }}
          >
            <VideoChatButton
              project_id={project_id}
              path={path}
              sendChat={(value) => {
                const actions = redux.getEditorActions(
                  project_id,
                  path,
                ) as ChatActions;
                actions.send_chat({ input: value });
              }}
            />
            <Tooltip title="Show TimeTravel change history of this side chat.">
              <Button
                onClick={() => {
                  actions.showTimeTravelInNewTab();
                }}
              >
                <Icon name="history" />
              </Button>
            </Tooltip>
          </Space.Compact>
          <CollabList
            addCollab={addCollab}
            project={project}
            actions={actions}
          />
          <AddChatCollab addCollab={addCollab} project_id={project_id} />
        </div>
      )}
      <Filter
        actions={actions}
        search={search}
        style={{
          margin: 0,
          ...(messages.size >= 2
            ? undefined
            : { visibility: "hidden", height: 0 }),
        }}
      />
      <div
        className="smc-vfill"
        style={{
          backgroundColor: "#fff",
          paddingLeft: "15px",
          flex: 1,
          margin: "5px 0",
        }}
      >
        <ChatLog
          fontSize={fontSize}
          project_id={project_id}
          path={path}
          scrollToBottomRef={scrollToBottomRef}
          mode={"sidechat"}
          setLastVisible={setLastVisible}
        />
      </div>

      <div>
        {input.trim() ? (
          <Flex vertical={false} align="center" justify="space-between">
            <Tooltip title="Send message (shift+enter)">
              <Space>
                {lastVisible && (
                  <Button
                    type="primary"
                    onClick={() => {
                      sendChat({ reply_to: new Date(lastVisible) });
                    }}
                  >
                    Reply (shift+enter)
                  </Button>
                )}
                <Button
                  type={!lastVisible ? "primary" : undefined}
                  style={{ margin: "5px 0 5px 5px" }}
                  onClick={() => {
                    sendChat();
                    user_activity("side_chat", "send_chat", "click");
                  }}
                  disabled={!input?.trim() || is_uploading}
                >
                  <Icon name="paper-plane" />
                  Start New Conversation
                </Button>
              </Space>
            </Tooltip>
            <LLMCostEstimationChat
              compact
              llm_cost={llm_cost_room}
              style={{ margin: "5px" }}
            />
          </Flex>
        ) : undefined}
        <ChatInput
          autoFocus
          cacheId={`${path}${project_id}-new`}
          input={input}
          on_send={() => {
            sendChat(lastVisible ? { reply_to: lastVisible } : undefined);
            user_activity("side_chat", "send_chat", "keyboard");
            actions?.clearAllFilters();
          }}
          style={{ height: INPUT_HEIGHT }}
          height={INPUT_HEIGHT}
          onChange={(value) => {
            actions.set_input(value);
            // submitMentionsRef processes the reply, but does not actually send the mentions
            const reply = submitMentionsRef.current?.(undefined, true) ?? value;
            actions?.llm_estimate_cost(reply, "room");
          }}
          submitMentionsRef={submitMentionsRef}
          syncdb={actions.syncdb}
          date={0}
          editBarStyle={{ overflow: "none" }}
        />
      </div>
    </div>
  );
}

function AddChatCollab({ addCollab, project_id }) {
  if (!addCollab) {
    return null;
  }
  return (
    <div>
      You can{" "}
      {redux.getProjectsStore().hasLanguageModelEnabled(project_id) && (
        <>chat with AI or notify a collaborator by typing @, </>
      )}
      <A href="https://github.com/sagemathinc/cocalc/discussions">
        join a discussion on GitHub
      </A>
      , and add more collaborators to this project below.
      <AddCollaborators project_id={project_id} autoFocus where="side-chat" />
      <div style={{ color: COLORS.GRAY_M }}>
        (Collaborators have access to all files in this project.)
      </div>
    </div>
  );
}

function CollabList({ project, addCollab, actions }) {
  return (
    <div
      style={
        !addCollab
          ? {
              maxHeight: "1.7em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              cursor: "pointer",
            }
          : { cursor: "pointer" }
      }
      onClick={() => actions.setState({ add_collab: !addCollab })}
    >
      <div style={{ width: "16px", display: "inline-block" }}>
        <Icon name={addCollab ? "caret-down" : "caret-right"} />
      </div>
      <span style={{ color: COLORS.GRAY_M, fontSize: "10pt" }}>
        <ProjectUsers
          project={project}
          none={<span>Add people to work with...</span>}
        />
      </span>
    </div>
  );
}
