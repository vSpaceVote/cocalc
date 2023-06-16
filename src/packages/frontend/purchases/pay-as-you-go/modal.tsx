import { Alert, Modal } from "antd";
import { useActions, useTypedRedux } from "@cocalc/frontend/app-framework";
import {
  Service,
  serviceToDisplay,
} from "@cocalc/util/db-schema/purchase-quotas";
import { Icon } from "@cocalc/frontend/components/icon";
import QuotaConfig from "../quota-config";
import { webapp_client } from "@cocalc/frontend/webapp-client";
import ServiceTag from "../service";
import Cost from "./cost";

/* must be big! 1000 for e.g., the jupyter generate modal */
export const zIndex = 2000;

export default function PayAsYouGoModal({}) {
  const actions = useActions("billing");

  const storeState: {
    showModal?: boolean;
    service?: Service;
    allowed?: boolean;
    cost?: number;
    reason?: string;
  } = useTypedRedux("billing", "pay_as_you_go")?.toJS() ?? {};

  const updateAllowed = async () => {
    const x = await webapp_client.purchases_client.isPurchaseAllowed(
      storeState.service as Service,
      storeState.cost
    );
    actions.setState({ pay_as_you_go: { ...storeState, ...x } as any });
  };
  const handleCancel = () => {
    actions.setState({ pay_as_you_go: { showModal: false } as any });
  };
  const handleOk = () => {
    actions.setState({ pay_as_you_go: { showModal: false } as any });
  };

  // destroyOnClose so values in quota input get updated
  return (
    <Modal
      width={"600px"}
      zIndex={zIndex}
      destroyOnClose
      maskClosable={false}
      open={storeState.showModal}
      title={
        <>
          <Icon name="credit-card" style={{ marginRight: "15px" }} /> Pay As You
          Go for{" "}
          <ServiceTag
            service={storeState.service as Service}
            style={{ fontSize: "16px" }}
          />
        </>
      }
      onCancel={handleCancel}
      onOk={handleOk}
    >
      {!storeState.allowed && (
        <Alert
          showIcon
          type="warning"
          style={{ margin: "15px 0" }}
          description={storeState.reason}
        />
      )}
      {storeState.allowed && (
        <Alert
          style={{ margin: "15px 0" }}
          showIcon
          type="success"
          description={
            <>
              Thanks, your use of{" "}
              {serviceToDisplay(storeState.service as Service)} should now be
              allowed!
            </>
          }
        />
      )}
      {storeState.service != null && (
        <div>
          <div style={{ color: "#666", marginBottom: "5px" }}>
            This service is charged on a pay-as-you-go basis according to the
            following rates:
          </div>
          <Cost service={storeState.service} />
        </div>
      )}
      <div style={{ marginBottom: "15px" }} />
      <QuotaConfig
        service={storeState.service as Service}
        updateAllowed={updateAllowed}
      />
    </Modal>
  );
}
