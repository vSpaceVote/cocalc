import { Table } from "./types";
import { CREATED, CREATED_BY, ID, NOTES } from "./crm";
import { SCHEMA as schema } from "./index";
import { SiteLicenseDescriptionDB } from "@cocalc/util/upgrades/shopping";

export interface Voucher {
  id: number;
  created: Date;
  created_by: string;
  title: string;
  active: Date;
  expire: Date;
  cancel_by: Date;
  cart: { description: SiteLicenseDescriptionDB; product: "site-license" }[];
  count: number;
  cost: number;
  tax: number;
  notes?: string;
}

Table({
  name: "vouchers",
  fields: {
    id: ID,
    created_by: CREATED_BY,
    created: CREATED,
    title: {
      type: "string",
      pg_type: "VARCHAR(254)",
      desc: "Title of this voucher.",
      render: {
        type: "text",
        maxLength: 254,
        editable: true,
      },
    },
    active: {
      title: "Active",
      type: "timestamp",
      desc: "When this voucher becomes active.",
      render: {
        type: "timestamp",
        editable: true,
      },
    },
    expire: {
      title: "Expire",
      type: "timestamp",
      desc: "When this voucher expires.",
      render: {
        type: "timestamp",
        editable: true,
      },
    },
    cancel_by: {
      title: "Cancel by this date",
      type: "timestamp",
      desc: "This voucher must be canceled by this date",
      render: {
        type: "timestamp",
        editable: true,
      },
    },
    cart: {
      // items in the shopping cart that were used to create this voucher.  This defines
      // what the voucher provides.
      type: "map",
      pg_type: "JSONB[]",
      desc: "Cart of items provided by this voucher.",
    },
    count: {
      type: "number",
      title: "Count",
      desc: "How many voucher codes were created.",
    },
    cost: {
      type: "number",
      desc: "How much one voucher costs in dollars.",
      render: { type: "number", editable: true, format: "money", min: 0 },
    },
    tax: {
      type: "number",
      desc: "How much sales tax in dollars for each redeemed voucher.",
      render: { type: "number", editable: true, format: "money", min: 0 },
    },
    notes: NOTES,
  },
  rules: {
    desc: "Vouchers",
    primary_key: "id",
    user_query: {
      get: {
        pg_where: [{ "created_by = $::UUID": "account_id" }],
        fields: {
          id: null,
          created_by: null,
          created: null,
          active: null,
          expire: null,
          cancel_by: null,
          title: null,
          count: null,
          cost: null,
          tax: null,
          cart: null,
        },
      },
      set: {
        fields: {
          created_by: "account_id",
          id: true,
        },
      },
    },
  },
});

Table({
  name: "crm_vouchers",
  rules: {
    virtual: "vouchers",
    primary_key: "id",
    user_query: {
      get: {
        pg_where: [],
        admin: true,
        fields: {
          id: null,
          created_by: null,
          created: null,
          active: null,
          expire: null,
          cancel_by: null,
          title: null,
          count: null,
          cost: null,
          tax: null,
          notes: null,
          cart: null,
        },
      },
      set: {
        admin: true,
        fields: {
          id: true,
          active: true,
          expire: true,
          cancel_by: true,
          title: true,
          cost: true,
          tax: true,
          notes: true,
        },
      },
    },
  },
  fields: schema.vouchers.fields,
});

export interface VoucherCode {
  code: string;
  id: number;
  created: Date;
  when_redeemed?: Date;
  redeemed_by?: string;
  canceled?: Date;
  notes?: string;
}

Table({
  name: "voucher_codes",
  fields: {
    code: { type: "string", desc: "The random code the determines this." },
    id: {
      type: "integer",
      title: "Voucher id",
      desc: "The unique id of the voucher that this is a code for.",
    },
    created: CREATED, // technically redundant since the vouchers id determines this; however it is convenient to have.
    when_redeemed: {
      type: "timestamp",
      title: "When Redeemed",
      desc: "When this voucher code was redeemed.",
      render: {
        type: "timestamp",
      },
    },
    redeemed_by: {
      type: "uuid",
      desc: "The uuid of the account that redeemed this voucher code.",
      render: { type: "account" },
      title: "Account",
    },
    canceled: {
      type: "timestamp",
      title: "When Canceled",
      desc: "When this voucher code was canceled. This is used if the user redeems the code, then cancel before the cancel-by date, e.g., because they drop a class.",
      render: {
        type: "timestamp",
      },
    },
    notes: NOTES,
  },
  rules: {
    desc: "Voucher codes",
    primary_key: "code",
    user_query: {
      get: {
        pg_where: [],
        admin: true,
        fields: {
          code: null,
          id: null,
          created: null,
          when_redeemed: null,
          redeemed_by: null,
          notes: null,
          canceled: null,
        },
      },
      set: {
        admin: true,
        fields: {
          code: true,
          id: true,
          when_redeemed: true,
          redeemed_by: true,
          notes: true,
          canceled: true,
        },
      },
    },
  },
});
