/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

/*
Voucher -- create vouchers from the contents of your shopping cart.
*/

import {
  Alert,
  Button,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Table,
  Space,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@cocalc/frontend/components/icon";
import { money } from "@cocalc/util/licenses/purchase/utils";
import { plural } from "@cocalc/util/misc";
import PaymentMethods from "components/billing/payment-methods";
import A from "components/misc/A";
import Loading from "components/share/loading";
import SiteName from "components/share/site-name";
import apiPost from "lib/api/post";
import useAPI from "lib/hooks/api";
import useIsMounted from "lib/hooks/mounted";
import { useRouter } from "next/router";
import { computeCost } from "@cocalc/util/licenses/store/compute-cost";
import { useProfileWithReload } from "lib/hooks/profile";
import { Paragraph } from "components/misc";
import {
  fullCost,
  discountedCost,
  getColumns,
  OrderError,
  RequireEmailAddress,
} from "./checkout";
import { COLORS } from "@cocalc/util/theme";
import vouchers, { CharSet, MAX_VOUCHERS } from "@cocalc/util/vouchers";

function dateStr(d) {
  return d?.toDate().toLocaleDateString();
}

export default function CreateVouchers() {
  const router = useRouter();
  const isMounted = useIsMounted();
  const { profile, reload: reloadProfile } = useProfileWithReload({
    noCache: true,
  });
  const [payNow, setPayNow] = useState<boolean>(true);
  const [placingOrder, setCreatingVouchers] = useState<boolean>(false);
  const [haveCreditCard, setHaveCreditCard] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string>("");
  const [subTotal, setSubTotal] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [numVouchers, setNumVouchers] = useState<number>(0);
  const [length, setLength] = useState<number>(8);
  const [title, setTitle] = useState<string>("");
  const [prefix, setPrefix] = useState<string>("");
  const [postfix, setPostfix] = useState<string>("");
  const [charset, setCharset] = useState<CharSet>("alphanumeric");
  const [active, setActive] = useState<dayjs.Dayjs | null>(dayjs());
  const [expire, setExpire] = useState<dayjs.Dayjs | null>(
    dayjs().add(30, "day")
  );
  const [cancelBy, setCancelBy] = useState<dayjs.Dayjs | null>(
    dayjs().add(14, "day")
  );
  const exampleCodes: string = useMemo(() => {
    return vouchers({ count: 5, length, charset, prefix, postfix }).join(", ");
  }, [length, charset, prefix, postfix]);

  // most likely, user will do the purchase and then see the congratulations page
  useEffect(() => {
    router.prefetch("/store/congrats");
  }, []);

  const cart0 = useAPI("/shopping/cart/get");

  const cart = useMemo(() => {
    return cart0.result?.filter((item) => item.description?.period == "range");
  }, [cart0.result]);

  const items = useMemo(() => {
    if (!cart) return undefined;
    const x: any[] = [];
    let subTotal = 0;
    for (const item of cart) {
      if (!item.checked) continue;
      item.cost = computeCost(item.description);
      subTotal += item.cost.cost;
      x.push(item);
    }
    setSubTotal(subTotal);
    return x;
  }, [cart]);

  if (cart0.error) {
    return <Alert type="error" message={cart.error} />;
  }
  if (!items) {
    return <Loading center />;
  }

  async function createVouchers() {
    try {
      setOrderError("");
      setCreatingVouchers(true);
      // This api call tells the backend, "create requested vouchers from everything in my
      // shopping cart that is not a subscription."
      await apiPost("/vouchers/create-vouchers", {
        count: numVouchers,
        expire,
        cancelBy,
        active,
        title,
        length,
        charset,
        prefix,
        postfix,
      });
      // Success!

      if (!isMounted.current) return;
      router.push("/store/congrats");
    } catch (err) {
      // The purchase failed.
      setOrderError(err.message);
    } finally {
      if (!isMounted.current) return;
      setCreatingVouchers(false);
    }
  }

  const columns = getColumns({ noDiscount: !payNow, voucherPeriod: true });

  const disabled =
    active == null ||
    !numVouchers ||
    !title?.trim() ||
    expire == null ||
    cancelBy == null ||
    subTotal == 0 ||
    placingOrder ||
    !haveCreditCard ||
    !profile?.email_address;

  function CreateVouchersButton() {
    const v = plural(numVouchers, "Voucher");
    return (
      <Button
        disabled={disabled}
        style={{ marginTop: "7px", marginBottom: "15px" }}
        size="large"
        type="primary"
        onClick={createVouchers}
      >
        {placingOrder ? (
          <Loading delay={0}>
            Creating {numVouchers} {v}...
          </Loading>
        ) : (
          <>
            Create {numVouchers} {v}
          </>
        )}
      </Button>
    );
  }

  function EmptyCart() {
    return (
      <div style={{ maxWidth: "800px", margin: "auto" }}>
        <h3>
          <Icon name={"shopping-cart"} style={{ marginRight: "5px" }} />
          {cart?.length > 0 && (
            <>
              Nothing in Your <SiteName />{" "}
              <A href="/store/cart">Shopping Cart</A> is Selected
            </>
          )}
          {(cart0.result?.length ?? 0) == 0 ? (
            <>
              Your <SiteName /> <A href="/store/cart">Shopping Cart</A> is Empty
            </>
          ) : (
            <>
              Your <SiteName /> <A href="/store/cart">Shopping Cart</A> must
              contain at least one non-subscription item
            </>
          )}
        </h3>
        You must have at least one non-subscription item in{" "}
        <A href="/store/cart">your cart</A> to create vouchers. Shop for{" "}
        <A href="/store/site-license">upgrades</A>, a{" "}
        <A href="/store/boost">license boost</A>, or a{" "}
        <A href="/dedicated">dedicated VM or disk</A>, and select a specific
        range of dates. When the voucher is redeemed it starts at the redemption
        date, and lasts for the same number of days as your shopping cart item.
      </div>
    );
  }

  // this can't just be a component, since it depends on a bunch of scope,
  function nonemptyCart(items) {
    return (
      <>
        <OrderError orderError={orderError} />
        <Row>
          <Col md={14} sm={24}>
            <div>
              <h3 style={{ fontSize: "16pt" }}>
                <Icon name={"gift2"} style={{ marginRight: "10px" }} />
                Create Vouchers
              </h3>
              <Paragraph style={{ color: "#666" }}>
                Vouchers are codes that you or anybody else can redeem{" "}
                <A href="/redeem">here</A> for the {items.length}{" "}
                {plural(items.length, "license")} listed below. The license
                start and end dates are shifted to match when the license is
                redeemed.
              </Paragraph>
              <h4 style={{ fontSize: "13pt", marginTop: "20px" }}>
                <Check done /> Pay Now or Invoice Later?
              </h4>
              <div>
                <Radio.Group
                  value={payNow ? "payNow" : "payLater"}
                  onChange={(e) => {
                    setPayNow(e.target.value == "payNow");
                  }}
                >
                  <Space
                    direction="vertical"
                    style={{ margin: "5px 0 15px 15px" }}
                  >
                    <Radio value={"payNow"}>Pay Now</Radio>
                    <Radio value={"payLater"} disabled={!profile?.is_partner}>
                      Pay Later: Invoice me later only for vouchers that were
                      redeemed
                    </Radio>
                  </Space>
                </Radio.Group>
                <br />
                <Paragraph style={{ color: "#666" }}>
                  {!profile?.is_partner ? (
                    <>
                      The pay later option is currently only available to
                      members of our partner program. If you're interested,
                      <A href="/support">contact support</A>.
                    </>
                  ) : (
                    <>
                      As a member of the partner program, you may select the
                      "Pay Later" option.
                    </>
                  )}
                </Paragraph>
              </div>
              <h4 style={{ fontSize: "13pt", marginTop: "20px" }}>
                <Check done={numVouchers > 0} /> How Many Vouchers?
              </h4>
              <Paragraph style={{ color: "#666" }}>
                Input the number of vouchers you would like to create. (Limit:{" "}
                {MAX_VOUCHERS})
                <div style={{ textAlign: "center", marginTop: "15px" }}>
                  <InputNumber
                    size="large"
                    min={0}
                    max={MAX_VOUCHERS}
                    defaultValue={numVouchers}
                    onChange={(value) => setNumVouchers(value ?? 1)}
                  />
                </div>
              </Paragraph>
              {!payNow && (
                <>
                  <h4 style={{ fontSize: "13pt", marginTop: "20px" }}>
                    <Check
                      done={
                        active != null && cancelBy != null && expire != null
                      }
                    />
                    When Vouchers become Active, can be Canceled, and Expire
                  </h4>
                  <Paragraph style={{ color: "#666" }}>
                    Vouchers cannot be redeemed before{" "}
                    {dateStr(active) ?? "the date below"}. You can choose a date
                    that is up to 30 days in the future, but it must be before
                    the cancel by date below.
                    <div style={{ textAlign: "center", marginTop: "15px" }}>
                      <Form
                        labelCol={{ span: 9 }}
                        wrapperCol={{ span: 9 }}
                        layout="horizontal"
                      >
                        <Form.Item label="Become Active">
                          <DatePicker
                            value={active}
                            presets={[
                              {
                                label: "Now",
                                value: dayjs(),
                              },
                              {
                                label: "+ 7 Days",
                                value: dayjs().add(7, "d"),
                              },
                              {
                                label: "+ 30 Days",
                                value: dayjs().add(30, "day"),
                              },
                            ]}
                            onChange={setActive}
                            disabledDate={(current) => {
                              if (!current) {
                                return true;
                              }
                              // Can not select days before today
                              if (current < dayjs().endOf("day")) {
                                return true;
                              }
                              // Cannot select days more than 30 days in the future.
                              if (
                                current > dayjs().endOf("day").add(30, "day")
                              ) {
                                return true;
                              }
                              // Must be before expire date:
                              if (expire != null && current >= expire) {
                                return true;
                              }
                              // Must be before cancelBy date:
                              if (cancelBy != null && current >= cancelBy) {
                                return true;
                              }
                              // ok
                              return false;
                            }}
                          />
                        </Form.Item>
                      </Form>
                    </div>
                  </Paragraph>
                  <Paragraph style={{ color: "#666" }}>
                    A redeemed voucher has up until{" "}
                    {dateStr(cancelBy) ?? "the date below"} to be canceled at no
                    charge. You might set this to be at the end of the drop
                    period for a university. You can choose a date that is up to
                    30 days in the future, but it must be before the expire by
                    date below.
                    <div style={{ textAlign: "center", marginTop: "15px" }}>
                      <Form
                        labelCol={{ span: 9 }}
                        wrapperCol={{ span: 9 }}
                        layout="horizontal"
                      >
                        <Form.Item label="Cancel By">
                          <DatePicker
                            value={cancelBy}
                            presets={[
                              {
                                label: "+ 7 Days",
                                value: dayjs().add(7, "d"),
                              },
                              {
                                label: "+ 14 Days",
                                value: dayjs().add(14, "day"),
                              },
                              {
                                label: "+ 30 Days",
                                value: dayjs().add(30, "day"),
                              },
                            ]}
                            onChange={setCancelBy}
                            disabledDate={(current) => {
                              if (!current) {
                                return true;
                              }
                              // Can not select days before today and today
                              if (current < dayjs().endOf("day")) {
                                return true;
                              }
                              // Cannot select days more than 30 days in the future.
                              if (
                                current > dayjs().endOf("day").add(30, "day")
                              ) {
                                return true;
                              }
                              // Must be before expire date:
                              if (expire != null && current >= expire) {
                                return true;
                              }
                              // Must be after active date:
                              if (active != null && current <= active) {
                                return true;
                              }
                              // ok
                              return false;
                            }}
                          />
                        </Form.Item>
                      </Form>
                    </div>
                  </Paragraph>{" "}
                  <Paragraph style={{ color: "#666" }}>
                    Any voucher that is not redeemed by{" "}
                    {dateStr(expire) ?? "the date below"} will expire. You can
                    choose a date that is up to 60 days in the future. You will
                    be invoiced only for vouchers that are redeemed before the
                    expiration date.
                    <div style={{ textAlign: "center", marginTop: "15px" }}>
                      <Form
                        labelCol={{ span: 9 }}
                        wrapperCol={{ span: 9 }}
                        layout="horizontal"
                      >
                        <Form.Item label="Expire">
                          <DatePicker
                            value={expire}
                            presets={[
                              {
                                label: "+ 7 Days",
                                value: dayjs().add(7, "d"),
                              },
                              {
                                label: "+ 30 Days",
                                value: dayjs().add(30, "day"),
                              },
                              {
                                label: "+ 45 Days",
                                value: dayjs().add(45, "day"),
                              },
                              {
                                label: "+ 60 Days",
                                value: dayjs().add(60, "day"),
                              },
                            ]}
                            onChange={setExpire}
                            disabledDate={(current) => {
                              if (!current) {
                                return true;
                              }
                              // Can not select days before today and today
                              if (current < dayjs().endOf("day")) {
                                return true;
                              }
                              // Cannot select days more than 60 days in the future.
                              if (
                                current > dayjs().endOf("day").add(60, "day")
                              ) {
                                return true;
                              }
                              // Must be after active date:
                              if (active != null && current <= active) {
                                return true;
                              }
                              // Must be after cancel by date:
                              if (cancelBy != null && current <= cancelBy) {
                                return true;
                              }
                              // ok
                              return false;
                            }}
                          />
                        </Form.Item>
                      </Form>
                    </div>
                  </Paragraph>
                </>
              )}
              <h4 style={{ fontSize: "13pt", marginTop: "20px" }}>
                <Check done={!!title.trim()} /> Customize
              </h4>
              <Paragraph style={{ color: "#666" }}>
                Describe this group of vouchers so you can easily find them
                later.
                <Input
                  style={{ marginBottom: "15px", marginTop: "5px" }}
                  onChange={(e) => setTitle(e.target.value)}
                  value={title}
                  addonBefore={"Description"}
                />
                Customize how your voucher codes are randomly generated
                (optional):
                <Space direction="vertical" style={{ marginTop: "5px" }}>
                  <Space>
                    <InputNumber
                      addonBefore={"Length"}
                      min={8}
                      max={16}
                      onChange={(length) => setLength(length ?? 8)}
                      value={length}
                    />
                    <Input
                      maxLength={10 /* also enforced via api */}
                      onChange={(e) => setPrefix(e.target.value)}
                      value={prefix}
                      addonBefore={"Prefix"}
                      allowClear
                    />
                    <Input
                      maxLength={10 /* also enforced via api */}
                      onChange={(e) => setPostfix(e.target.value)}
                      value={postfix}
                      addonBefore={"Postfix"}
                      allowClear
                    />{" "}
                  </Space>
                  <Space>
                    <Radio.Group
                      onChange={(e) => {
                        setCharset(e.target.value);
                      }}
                      defaultValue={charset}
                    >
                      <Radio.Button value="alphanumeric">
                        alphanumeric
                      </Radio.Button>
                      <Radio.Button value="alphabetic">alphabetic</Radio.Button>
                      <Radio.Button value="numbers">0123456789</Radio.Button>
                      <Radio.Button value="lower">lower</Radio.Button>
                      <Radio.Button value="upper">UPPER</Radio.Button>
                    </Radio.Group>
                  </Space>
                  <Space>
                    <div style={{ whiteSpace: "nowrap" }}>Examples:</div>{" "}
                    {exampleCodes}
                  </Space>
                </Space>
              </Paragraph>
              <h4 style={{ fontSize: "13pt", marginTop: "20px" }}>
                <Check done={haveCreditCard} /> Ensure a Payment Method is on
                File{" "}
              </h4>
              <Paragraph style={{ color: "#666" }}>
                {payNow ? (
                  <>
                    The default payment method shown below will be used to pay
                    for the vouchers. You will be charged when you click the
                    button below to create your vouchers.
                  </>
                ) : (
                  <>
                    The default payment method shown below will be used to pay
                    for the redeemed vouchers, unless you change the payment
                    method before you are invoiced.
                  </>
                )}
              </Paragraph>
              <PaymentMethods
                startMinimized
                setTaxRate={setTaxRate}
                setHaveCreditCard={setHaveCreditCard}
              />
            </div>
          </Col>
          <Col md={{ offset: 1, span: 9 }} sm={{ span: 24, offset: 0 }}>
            <div>
              <div
                style={{
                  textAlign: "center",
                  border: "1px solid #ddd",
                  padding:
                    "30px 15px" /* 30px so amount can wrap and still in */,
                  borderRadius: "5px",
                  minWidth: "300px",
                }}
              >
                <CreateVouchersButton />
                <Terms payNow={payNow} />
                <VoucherSummary
                  items={items}
                  taxRate={taxRate}
                  numVouchers={numVouchers}
                  payNow={payNow}
                />
                <span style={{ fontSize: "13pt" }}>
                  <TotalCost
                    items={items}
                    taxRate={taxRate}
                    numVouchers={numVouchers}
                    payNow={payNow}
                  />
                </span>
              </div>
            </div>
          </Col>
        </Row>

        <h4 style={{ fontSize: "13pt", marginTop: "15px" }}>
          <Check done />
          {numVouchers == 1
            ? "Your Voucher"
            : `Each of Your ${numVouchers} Vouchers`}{" "}
          Provides the Following {items.length}{" "}
          {plural(items.length, "License")}
        </h4>
        <Paragraph style={{ color: "#666" }}>
          These are the licenses with a fixed range of time from your shopping
          cart (vouchers cannot be used to create subscriptions). When used, the
          voucher is redeemed for one or more license starting at the time of
          redemption and running for the same length of time as each license
          listed below.
        </Paragraph>
        <div style={{ border: "1px solid #eee" }}>
          <Table
            showHeader={false}
            columns={columns}
            dataSource={items}
            rowKey={"id"}
            pagination={{ hideOnSinglePage: true }}
          />
        </div>
        <h4 style={{ fontSize: "13pt", marginTop: "30px" }}>
          <Check done={!disabled} /> Create Your{" "}
          {plural(numVouchers, "Voucher")}
        </h4>
        <div style={{ fontSize: "12pt" }}>
          <Row>
            <Col sm={12}>
              <CreateVouchersButton />
            </Col>
            <Col sm={12}>
              <div style={{ fontSize: "15pt" }}>
                <TotalCost
                  items={cart}
                  taxRate={taxRate}
                  numVouchers={numVouchers}
                  payNow={payNow}
                />
                <br />
                <Terms payNow={payNow} />
              </div>
            </Col>
          </Row>
        </div>
      </>
    );
  }

  return (
    <>
      <RequireEmailAddress profile={profile} reloadProfile={reloadProfile} />
      {items.length == 0 && <EmptyCart />}
      {items.length > 0 && nonemptyCart(items)}
      <OrderError orderError={orderError} />
    </>
  );
}

function TotalCost({ items, taxRate, numVouchers, payNow }) {
  const cost =
    numVouchers *
    (payNow ? discountedCost(items) : fullCost(items)) *
    (1 + taxRate);
  return (
    <>
      {payNow ? "Total Amount" : "Maximum Amount"}:{" "}
      <b style={{ float: "right", color: "darkred" }}>{money(cost)}</b>
    </>
  );
}

function Terms({ payNow }) {
  return (
    <Paragraph style={{ color: COLORS.GRAY, fontSize: "10pt" }}>
      By creating vouchers, you agree to{" "}
      <A href="/policies/terms" external>
        our terms of service,
      </A>{" "}
      {payNow ? (
        <>and agree to pay for the vouchers you have requested</>
      ) : (
        <>
          and agree to pay for any vouchers that are redeemed, up to the maxium
          amount listed here.
        </>
      )}
    </Paragraph>
  );
}

function VoucherSummary({ items, taxRate, numVouchers, payNow }) {
  const full = numVouchers * fullCost(items);
  const discounted = numVouchers * discountedCost(items);
  const tax = full * taxRate;
  return (
    <Paragraph style={{ textAlign: "left" }}>
      <b style={{ fontSize: "14pt" }}>Summary</b>
      <Paragraph style={{ color: "#666" }}>
        You will be invoiced for up to {money(full + tax, true)}, depending on
        how many vouchers are redeeemed. If no vouchers are redeemed you will
        not pay anything.
      </Paragraph>
      <div>
        {numVouchers} Vouchers:{" "}
        <span style={{ float: "right" }}>{money(full, true)}</span>
      </div>
      <div>
        Self-service Discount{!payNow ? " (only if pay now)" : ""}:
        <span style={{ float: "right" }}>
          {payNow ? money(-(full - discounted), true) : money(0, true)}
        </span>
      </div>
      <div>
        Estimated tax:{" "}
        <span style={{ float: "right" }}>{money(tax, true)}</span>
      </div>
    </Paragraph>
  );
}

const CHECK_STYLE = { marginRight: "5px", fontSize: "14pt" };
function Check({ done }) {
  if (done) {
    return <Icon name="check" style={{ ...CHECK_STYLE, color: "green" }} />;
  } else {
    return (
      <Icon name="arrow-right" style={{ ...CHECK_STYLE, color: "#cf1322" }} />
    );
  }
}
