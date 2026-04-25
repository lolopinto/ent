import {
  ActionOperation,
  BigIntegerType,
  BinaryTextType,
  BooleanType,
  ByteaType,
  ConstraintType,
  DateType,
  EntSchema,
  EnumListType,
  EnumType,
  FloatListType,
  FloatType,
  IntegerEnumListType,
  IntegerEnumType,
  IntegerListType,
  IntegerType,
  JSONBType,
  JSONType,
  NoFields,
  StringListType,
  StringType,
  StructType,
  StructTypeAsList,
  TimeType,
  TimestampType,
  TimestamptzType,
  TimetzType,
  UnionType,
  UUIDListType,
  UUIDType,
  requiredField,
  optionalField,
} from "@snowtop/ent/schema";
import { AlwaysAllowPrivacyPolicy, AlwaysDenyPrivacyPolicy } from "@snowtop/ent";

const PaymentSchema = new EntSchema({
  tableName: "matrix_payments",
  patterns: [],
  supportUpsert: true,
  showCanViewerSee: true,
  showCanViewerEdit: true,
  defaultActionPrivacy: AlwaysAllowPrivacyPolicy,
  fields: {
    externalID: StringType({
      storageKey: "external_id",
    }),
    amount: IntegerType({
      index: true,
      indexConcurrently: true,
      indexWhere: "amount > 0",
    }),
    settled: BooleanType({
      nullable: true,
    }),
    ratio: FloatType({
      nullable: true,
    }),
    bigintAmount: BigIntegerType({
      nullable: true,
    }),
    description: StringType({
      nullable: true,
      private: {
        exposeToActions: true,
      },
    }),
    visibleCode: StringType({
      hideFromGraphQL: true,
      disableUserGraphQLEditable: true,
      defaultValueOnCreate: () => "hidden",
    }),
    createdAtOverride: TimestampType({
      disableUserEditable: true,
      defaultValueOnCreate: () => new Date(),
    }),
    editedAt: TimestamptzType({
      nullable: true,
      defaultValueOnEdit: () => new Date(),
    }),
    paidAt: DateType({
      nullable: true,
      immutable: true,
    }),
    localTime: TimeType({ nullable: true }),
    localTimetz: TimetzType({ nullable: true }),
    payload: JSONType({
      nullable: true,
    }),
    metadata: JSONBType({
      nullable: true,
      tsType: "PaymentMetadata",
      graphQLType: "PaymentMetadata",
      fields: {
        attempt: IntegerType(),
        source: StringType(),
      },
    }),
    tags: StringListType({
      nullable: true,
    }),
    scores: IntegerListType({
      nullable: true,
    }),
    ratios: FloatListType({
      nullable: true,
    }),
    receiptBytes: ByteaType({
      nullable: true,
      hideFromGraphQL: true,
    }),
    receiptText: BinaryTextType({
      nullable: true,
      hideFromGraphQL: true,
    }),
    status: EnumType({
      values: ["PENDING", "SETTLED", "FAILED"],
      disableUnknownType: true,
      defaultValueOnCreate: () => "PENDING",
    }),
    statusHistory: EnumListType({
      values: ["PENDING", "SETTLED", "FAILED"],
      nullable: true,
    }),
    priority: IntegerEnumType({
      map: {
        LOW: 1,
        HIGH: 2,
      },
      deprecated: {
        LEGACY: 0,
      },
    }),
    priorityHistory: IntegerEnumListType({
      map: {
        LOW: 1,
        HIGH: 2,
      },
      nullable: true,
    }),
    threadID: UUIDType({
      nullable: true,
      fieldEdge: {
        schema: "Thread",
        inverseEdge: {
          name: "payments",
          edgeConstName: "ThreadToPayments",
        },
      },
    }),
    indexedThreadID: UUIDType({
      nullable: true,
      index: true,
      fieldEdge: {
        schema: "Thread",
        edgeConstName: "IndexedThreadToPayments",
        indexEdge: {
          name: "payments_for_indexed_thread",
          orderby: [
            {
              column: "created_at",
              direction: "DESC",
            },
          ],
        },
      },
    }),
    entID: UUIDType({
      index: true,
      fieldEdge: {
        schema: "MatrixEnt",
        edgeConstName: "EntToPayments",
        indexEdge: {
          name: "payments_for_ent",
        },
      },
    }),
    createdByID: UUIDType({
      foreignKey: {
        schema: "User",
        column: "id",
        name: "payment_created_by",
        disableBuilderType: true,
        ondelete: "SET NULL",
      },
      nullable: true,
    }),
    ownerID: UUIDType({
      index: true,
      polymorphic: {
        name: "owner",
        types: ["User", "MatrixEnt"],
        hideFromInverseGraphQL: true,
        disableBuilderType: true,
        edgeConstName: "OwnerToPayments",
      },
    }),
    horseIDs: UUIDListType({
      nullable: true,
      fieldEdge: {
        schema: "Horse",
        inverseEdge: {
          name: "payments",
        },
      },
    }),
    auditEntries: StructTypeAsList({
      tsType: "PaymentAuditEntry",
      graphQLType: "PaymentAuditEntry",
      nullable: true,
      privacyPolicy: AlwaysDenyPrivacyPolicy,
      fields: {
        changedByID: UUIDType({
          nullable: true,
          foreignKey: {
            schema: "User",
            column: "id",
          },
        }),
        changedByType: StringType({
          nullable: true,
        }),
        comment: StringType({
          storageKey: "comment_text",
          nullable: true,
        }),
        relatedIDs: UUIDListType({
          nullable: true,
        }),
      },
    }),
    nestedObject: StructType({
      tsType: "PaymentNestedObject",
      nullable: true,
      fetchOnDemand: true,
      fields: {
        uuid: UUIDType({
          disableBase64Encode: true,
        }),
        unionValue: UnionType({
          tsType: "PaymentUnionValue",
          nullable: true,
          fields: {
            card: StructType({
              tsType: "PaymentCard",
              fields: {
                lastFour: StringType(),
              },
            }),
            bank: StructType({
              tsType: "PaymentBank",
              fields: {
                routingNumber: StringType(),
              },
            }),
          },
        }),
      },
    }),
    dbOnlyNote: StringType({
      nullable: true,
      dbOnly: true,
    }),
  },
  fieldOverrides: {
    createdAt: {
      index: true,
      indexConcurrently: true,
    },
    updatedAt: {
      storageKey: "updated_time",
      graphqlName: "updatedTime",
    },
  },
  constraints: [
    {
      name: "payments_external_amount_unique",
      type: ConstraintType.Unique,
      columns: ["externalID", "amount"],
    },
    {
      name: "payments_amount_positive",
      type: ConstraintType.Check,
      columns: [],
      condition: "amount >= 0",
    },
    {
      name: "payments_thread_fk",
      type: ConstraintType.ForeignKey,
      columns: ["threadID"],
      fkey: {
        tableName: "threads",
        columns: ["id"],
        ondelete: "SET NULL",
      },
    },
  ],
  indices: [
    {
      name: "payments_amount_idx",
      columns: ["amount"],
      unique: true,
      where: "amount > 0",
    },
  ],
  edges: [
    {
      name: "watchers",
      schemaName: "User",
      symmetric: true,
      edgeConstName: "PaymentWatchers",
      edgeActions: [
        {
          operation: ActionOperation.AddEdge,
          actionName: "AddPaymentWatcherAction",
          inputName: "AddPaymentWatcherInput",
          graphQLName: "addPaymentWatcher",
          __canFailBETA: true,
          actionOnlyFields: [
            {
              name: "reason",
              type: "String",
              nullable: true,
            },
          ],
        },
        {
          operation: ActionOperation.RemoveEdge,
          hideFromGraphQL: true,
        },
      ],
    },
    {
      name: "approver",
      schemaName: "User",
      unique: true,
      inverseEdge: {
        name: "approvedPayments",
        edgeConstName: "UserToApprovedPayments",
      },
      hideFromGraphQL: true,
    },
  ],
  edgeGroups: [
    {
      name: "PaymentReview",
      groupStatusName: "PaymentReviewStatus",
      tableName: "payment_review_edges",
      assocEdges: [
        {
          name: "needsReview",
          schemaName: "User",
        },
        {
          name: "reviewed",
          schemaName: "User",
        },
      ],
      viewerBased: true,
      statusEnums: ["needsReview", "reviewed"],
      nullStates: ["none"],
      nullStateFn: "getNullPaymentReviewStatus",
      edgeAction: {
        operation: ActionOperation.EdgeGroup,
        actionName: "SetPaymentReviewStatusAction",
        inputName: "SetPaymentReviewStatusInput",
        graphQLName: "setPaymentReviewStatus",
        actionOnlyFields: [
          {
            name: "note",
            type: "String",
            optional: true,
          },
        ],
      },
    },
  ],
  actions: [
    {
      operation: ActionOperation.Create,
      fields: [
        "externalID",
        "amount",
        requiredField("entID"),
        optionalField("description"),
      ],
      actionName: "CreateMatrixPaymentAction",
      inputName: "CreateMatrixPaymentInput",
      graphQLName: "createMatrixPayment",
      canViewerDo: {
        addAllFields: true,
      },
      actionOnlyFields: [
        {
          name: "metadataPatch",
          type: "JSON",
          nullable: true,
        },
      ],
    },
    {
      operation: ActionOperation.Edit,
      fields: ["description", "settled"],
      optionalFields: ["description"],
      requiredFields: ["settled"],
      actionOnlyFields: [
        {
          name: "reviewItems",
          type: "String",
          list: true,
          nullable: "contentsAndList",
        },
      ],
      __canFailBETA: true,
    },
    {
      operation: ActionOperation.Edit,
      actionName: "TouchMatrixPaymentAction",
      fields: [NoFields],
      hideFromGraphQL: true,
    },
    {
      operation: ActionOperation.Delete,
    },
  ],
});

export default PaymentSchema;
