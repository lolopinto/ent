/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is not neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/schema/user.ts":
/*!****************************!*\
  !*** ./src/schema/user.ts ***!
  \****************************/
/*! namespace exports */
/*! export default [provided] [no usage info] [missing usage info prevents renaming] */
/*! other exports [not provided] [no usage info] */
/*! runtime requirements: __webpack_require__, __webpack_exports__, __webpack_require__.d, __webpack_require__.r, __webpack_require__.* */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => /* binding */ User\n/* harmony export */ });\n/* harmony import */ var ent_schema__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ent/schema */ \"../../src/schema.ts\");\n/* harmony import */ var ent_field__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ent/field */ \"../../src/field.ts\");\n\n\nclass User extends ent_schema__WEBPACK_IMPORTED_MODULE_0__.BaseEntSchema {\n    constructor() {\n        super(...arguments);\n        this.fields = [\n            (0,ent_field__WEBPACK_IMPORTED_MODULE_1__.StringType)({ name: \"FirstName\" }),\n            (0,ent_field__WEBPACK_IMPORTED_MODULE_1__.StringType)({ name: \"LastName\" }),\n            (0,ent_field__WEBPACK_IMPORTED_MODULE_1__.StringType)({ name: \"EmailAddress\", unique: true }),\n            // TODO support enums: UNVERIFIED, VERIFIED, DEACTIVATED, DISABLED etc.\n            // TODO shouldn't really be nullable. same issue as #35\n            (0,ent_field__WEBPACK_IMPORTED_MODULE_1__.StringType)({ name: \"AccountStatus\", nullable: true }),\n            (0,ent_field__WEBPACK_IMPORTED_MODULE_1__.BooleanType)({\n                name: \"emailVerified\",\n                hideFromGraphQL: true,\n                serverDefault: \"FALSE\",\n            }),\n        ];\n        this.edges = [\n            {\n                name: \"createdEvents\",\n                schemaName: \"Event\",\n            },\n            {\n                name: \"friends\",\n                schemaName: \"User\",\n                symmetric: true,\n            },\n            {\n                name: \"selfContact\",\n                unique: true,\n                schemaName: \"Contact\",\n            },\n        ];\n        // create, edit, delete\n        // TODO break edit into editEmail or something\n        this.actions = [\n            {\n                operation: ent_schema__WEBPACK_IMPORTED_MODULE_0__.ActionOperation.Create,\n                fields: [\"FirstName\", \"LastName\", \"EmailAddress\"],\n            },\n            {\n                operation: ent_schema__WEBPACK_IMPORTED_MODULE_0__.ActionOperation.Edit,\n                fields: [\"FirstName\", \"LastName\"],\n            },\n            {\n                operation: ent_schema__WEBPACK_IMPORTED_MODULE_0__.ActionOperation.Delete,\n            },\n        ];\n    }\n}\n\n\n//# sourceURL=webpack:///./src/schema/user.ts?");

/***/ }),

/***/ "../../src/field.ts":
/*!**************************!*\
  !*** ../../src/field.ts ***!
  \**************************/
/*! namespace exports */
/*! export Boolean [provided] [no usage info] [missing usage info prevents renaming] */
/*! export BooleanType [provided] [no usage info] [missing usage info prevents renaming] */
/*! export Float [provided] [no usage info] [missing usage info prevents renaming] */
/*! export FloatType [provided] [no usage info] [missing usage info prevents renaming] */
/*! export Integer [provided] [no usage info] [missing usage info prevents renaming] */
/*! export IntegerType [provided] [no usage info] [missing usage info prevents renaming] */
/*! export String [provided] [no usage info] [missing usage info prevents renaming] */
/*! export StringType [provided] [no usage info] [missing usage info prevents renaming] */
/*! export Time [provided] [no usage info] [missing usage info prevents renaming] */
/*! export TimeType [provided] [no usage info] [missing usage info prevents renaming] */
/*! export UUID [provided] [no usage info] [missing usage info prevents renaming] */
/*! export UUIDType [provided] [no usage info] [missing usage info prevents renaming] */
/*! other exports [not provided] [no usage info] */
/*! runtime requirements: __webpack_require__, __webpack_exports__, __webpack_require__.d, __webpack_require__.r, __webpack_require__.* */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"UUID\": () => /* binding */ UUID,\n/* harmony export */   \"UUIDType\": () => /* binding */ UUIDType,\n/* harmony export */   \"Integer\": () => /* binding */ Integer,\n/* harmony export */   \"IntegerType\": () => /* binding */ IntegerType,\n/* harmony export */   \"Float\": () => /* binding */ Float,\n/* harmony export */   \"FloatType\": () => /* binding */ FloatType,\n/* harmony export */   \"Boolean\": () => /* binding */ Boolean,\n/* harmony export */   \"BooleanType\": () => /* binding */ BooleanType,\n/* harmony export */   \"String\": () => /* binding */ String,\n/* harmony export */   \"StringType\": () => /* binding */ StringType,\n/* harmony export */   \"Time\": () => /* binding */ Time,\n/* harmony export */   \"TimeType\": () => /* binding */ TimeType\n/* harmony export */ });\n/* harmony import */ var _schema__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./schema */ \"../../src/schema.ts\");\n\nclass BaseField {\n}\nclass UUID extends BaseField {\n    constructor() {\n        super(...arguments);\n        this.type = { dbType: _schema__WEBPACK_IMPORTED_MODULE_0__.DBType.UUID };\n    }\n}\nfunction UUIDType(options) {\n    let result = new UUID();\n    for (const key in options) {\n        const value = options[key];\n        result[key] = value;\n    }\n    return result;\n}\nclass Integer extends BaseField {\n    constructor() {\n        super(...arguments);\n        this.type = { dbType: _schema__WEBPACK_IMPORTED_MODULE_0__.DBType.Int };\n    }\n}\nfunction IntegerType(options) {\n    let result = new Integer();\n    for (const key in options) {\n        const value = options[key];\n        result[key] = value;\n    }\n    return result;\n}\nclass Float extends BaseField {\n    constructor() {\n        super(...arguments);\n        this.type = { dbType: _schema__WEBPACK_IMPORTED_MODULE_0__.DBType.Float };\n    }\n}\nfunction FloatType(options) {\n    let result = new Float();\n    for (const key in options) {\n        const value = options[key];\n        result[key] = value;\n    }\n    return result;\n}\nclass Boolean extends BaseField {\n    constructor() {\n        super(...arguments);\n        this.type = { dbType: _schema__WEBPACK_IMPORTED_MODULE_0__.DBType.Boolean };\n    }\n}\nfunction BooleanType(options) {\n    let result = new Boolean();\n    for (const key in options) {\n        const value = options[key];\n        result[key] = value;\n    }\n    return result;\n}\nclass String extends BaseField {\n    constructor() {\n        super(...arguments);\n        this.type = { dbType: _schema__WEBPACK_IMPORTED_MODULE_0__.DBType.String };\n        this.validators = [];\n        this.formatters = [];\n    }\n    valid(val) {\n        // TODO minLen, maxLen, length\n        // TODO play with API more and figure out if I want functions ala below\n        // or properties ala this\n        // both doable but which API is better ?\n        // if (this.minLen) {\n        //   this.validate(function())\n        // }\n        for (const validator of this.validators) {\n            if (!validator(val)) {\n                return false;\n            }\n        }\n        return true;\n    }\n    format(val) {\n        for (const formatter of this.formatters) {\n            val = formatter(val);\n        }\n        return val;\n    }\n    validate(validator) {\n        this.validators.push(validator);\n        return this;\n    }\n    formatter(formatter) {\n        this.formatters.push(formatter);\n        return this;\n    }\n    match(pattern) {\n        return this.validate(function (str) {\n            let r = new RegExp(pattern);\n            return r.test(str);\n        });\n    }\n    doesNotMatch(pattern) {\n        return this.validate(function (str) {\n            let r = new RegExp(pattern);\n            return !r.test(str);\n        });\n    }\n    toLowerCase() {\n        return this.formatter(function (str) {\n            return str.toLowerCase();\n        });\n    }\n    toUpperCase() {\n        return this.formatter(function (str) {\n            return str.toUpperCase();\n        });\n    }\n}\nfunction StringType(options) {\n    let result = new String();\n    for (const key in options) {\n        const value = options[key];\n        result[key] = value;\n    }\n    return result;\n}\nclass Time extends BaseField {\n    constructor() {\n        super(...arguments);\n        this.type = { dbType: _schema__WEBPACK_IMPORTED_MODULE_0__.DBType.Time };\n    }\n}\nfunction TimeType(options) {\n    let result = new Time();\n    for (const key in options) {\n        const value = options[key];\n        result[key] = value;\n    }\n    return result;\n}\n// export class JSON extends BaseField implements Field {\n//   type: Type = {dbType: DBType.JSON}\n// }\n\n\n//# sourceURL=webpack:///../../src/field.ts?");

/***/ }),

/***/ "../../src/schema.ts":
/*!***************************!*\
  !*** ../../src/schema.ts ***!
  \***************************/
/*! namespace exports */
/*! export ActionOperation [provided] [no usage info] [missing usage info prevents renaming] */
/*! export BaseEntSchema [provided] [no usage info] [missing usage info prevents renaming] */
/*! export DBType [provided] [no usage info] [missing usage info prevents renaming] */
/*! export Node [provided] [no usage info] [missing usage info prevents renaming] */
/*! export Timestamps [provided] [no usage info] [missing usage info prevents renaming] */
/*! export getFields [provided] [no usage info] [missing usage info prevents renaming] */
/*! other exports [not provided] [no usage info] */
/*! runtime requirements: __webpack_require__, __webpack_exports__, __webpack_require__.d, __webpack_require__.r, __webpack_require__.* */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"DBType\": () => /* binding */ DBType,\n/* harmony export */   \"Timestamps\": () => /* binding */ Timestamps,\n/* harmony export */   \"Node\": () => /* binding */ Node,\n/* harmony export */   \"BaseEntSchema\": () => /* binding */ BaseEntSchema,\n/* harmony export */   \"getFields\": () => /* binding */ getFields,\n/* harmony export */   \"ActionOperation\": () => /* binding */ ActionOperation\n/* harmony export */ });\n/* harmony import */ var uuid__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! uuid */ \"../../node_modules/uuid/dist/esm-node/index.js\");\n\n// we want --strictNullChecks flag so nullable is used to type graphql, ts, db\n// should eventually generate (boolean | null) etc\n// supported db types\nvar DBType;\n(function (DBType) {\n    DBType[\"UUID\"] = \"UUID\";\n    DBType[\"Int64ID\"] = \"Int64ID\";\n    DBType[\"Boolean\"] = \"Boolean\";\n    DBType[\"Int\"] = \"Int\";\n    DBType[\"Float\"] = \"Float\";\n    DBType[\"String\"] = \"String\";\n    DBType[\"Time\"] = \"Time\";\n    DBType[\"JSON\"] = \"JSON\";\n})(DBType || (DBType = {}));\nlet tsFields;\ntsFields = [\n    {\n        name: \"createdAt\",\n        type: {\n            dbType: DBType.Time,\n        },\n        hideFromGraphQL: true,\n        disableUserEditable: true,\n        defaultValueOnCreate: () => {\n            return new Date();\n        },\n    },\n    {\n        name: \"updatedAt\",\n        type: {\n            dbType: DBType.Time,\n        },\n        hideFromGraphQL: true,\n        disableUserEditable: true,\n        defaultValueOnCreate: () => {\n            return new Date();\n        },\n        defaultValueOnEdit: () => {\n            return new Date();\n        },\n    },\n];\n// Timestamps is a Pattern that adds a createdAt and updatedAt timestamp fields to the ent\nconst Timestamps = {\n    fields: tsFields,\n};\nlet nodeFields = [\n    {\n        name: \"ID\",\n        type: {\n            dbType: DBType.UUID,\n        },\n        primaryKey: true,\n        disableUserEditable: true,\n        defaultValueOnCreate: () => {\n            return (0,uuid__WEBPACK_IMPORTED_MODULE_0__.v4)();\n        },\n    },\n];\nnodeFields = nodeFields.concat(tsFields);\n// Node is a Pattern that adds 3 fields to the ent: (id, createdAt, and updatedAt timestamps)\nconst Node = {\n    fields: nodeFields,\n};\n// Base ent schema. has Node Pattern by default.\n// exists just to have less typing and easier for clients to implement\nclass BaseEntSchema {\n    constructor() {\n        this.patterns = [Node];\n    }\n}\nfunction isSchema(value) {\n    return value.fields !== undefined;\n}\nfunction getFields(value) {\n    let schema;\n    if (isSchema(value)) {\n        schema = value;\n    }\n    else {\n        schema = new value();\n    }\n    let m = new Map();\n    if (schema.patterns) {\n        for (const pattern of schema.patterns) {\n            for (const field of pattern.fields) {\n                m.set(field.name, field);\n            }\n        }\n    }\n    for (const field of schema.fields) {\n        m.set(field.name, field);\n    }\n    return m;\n}\n// this maps to ActionOperation in ent/action.go\nvar ActionOperation;\n(function (ActionOperation) {\n    // Create generates a create action for the ent. If no fields are provided, uses all fields\n    // on the ent. Doesn't include private fields if no fields are provided.\n    ActionOperation[ActionOperation[\"Create\"] = 1] = \"Create\";\n    // Edit generates an edit action for the ent. If no fields are provided, uses all fields\n    // on the ent. Can have multiple EditActions with different fields provided. Doesn't include\n    // private fields if no fields are provided.\n    ActionOperation[ActionOperation[\"Edit\"] = 2] = \"Edit\";\n    // Delete generates a delete action for the ent.\n    ActionOperation[ActionOperation[\"Delete\"] = 4] = \"Delete\";\n    // Mutations is a shortcut to generate create, edit, and delete actions for an ent\n    // Can be used to boostrap ents or for simple ents where the granularity of actions is overkill\n    // Provides CUD\tof CRUD. Can be the default for most ents. Should rarely be used for the `User` or `Account` ent\n    ActionOperation[ActionOperation[\"Mutations\"] = 8] = \"Mutations\";\n    // AddEdge is used to provide the ability to add an edge in an AssociationEdge.\n    ActionOperation[ActionOperation[\"AddEdge\"] = 16] = \"AddEdge\";\n    // RemoveEdge is used to provide the ability to remove an edge in an AssociationEdge.\n    ActionOperation[ActionOperation[\"RemoveEdge\"] = 32] = \"RemoveEdge\";\n    // EdgeGroup is used to provide the abilith to edit an edge group in an AssociationEdgeGroup.\n    ActionOperation[ActionOperation[\"EdgeGroup\"] = 64] = \"EdgeGroup\";\n})(ActionOperation || (ActionOperation = {}));\n\n\n//# sourceURL=webpack:///../../src/schema.ts?");

/***/ }),

/***/ "../../node_modules/uuid/dist/esm-node/bytesToUuid.js":
/*!************************************************************!*\
  !*** ../../node_modules/uuid/dist/esm-node/bytesToUuid.js ***!
  \************************************************************/
/*! namespace exports */
/*! export default [provided] [no usage info] [missing usage info prevents renaming] */
/*! other exports [not provided] [no usage info] */
/*! runtime requirements: __webpack_exports__, __webpack_require__.r, __webpack_require__.d, __webpack_require__.* */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => __WEBPACK_DEFAULT_EXPORT__\n/* harmony export */ });\n/**\n * Convert array of 16 byte values to UUID string format of the form:\n * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX\n */\nvar byteToHex = [];\n\nfor (var i = 0; i < 256; ++i) {\n  byteToHex[i] = (i + 0x100).toString(16).substr(1);\n}\n\nfunction bytesToUuid(buf, offset) {\n  var i = offset || 0;\n  var bth = byteToHex; // join used to fix memory issue caused by concatenation: https://bugs.chromium.org/p/v8/issues/detail?id=3175#c4\n\n  return [bth[buf[i++]], bth[buf[i++]], bth[buf[i++]], bth[buf[i++]], '-', bth[buf[i++]], bth[buf[i++]], '-', bth[buf[i++]], bth[buf[i++]], '-', bth[buf[i++]], bth[buf[i++]], '-', bth[buf[i++]], bth[buf[i++]], bth[buf[i++]], bth[buf[i++]], bth[buf[i++]], bth[buf[i++]]].join('');\n}\n\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (bytesToUuid);\n\n//# sourceURL=webpack:///../../node_modules/uuid/dist/esm-node/bytesToUuid.js?");

/***/ }),

/***/ "../../node_modules/uuid/dist/esm-node/index.js":
/*!******************************************************!*\
  !*** ../../node_modules/uuid/dist/esm-node/index.js ***!
  \******************************************************/
/*! namespace exports */
/*! export v1 [provided] [no usage info] [missing usage info prevents renaming] */
/*! export v3 [provided] [no usage info] [missing usage info prevents renaming] */
/*! export v4 [provided] [no usage info] [missing usage info prevents renaming] */
/*! export v5 [provided] [no usage info] [missing usage info prevents renaming] */
/*! other exports [not provided] [no usage info] */
/*! runtime requirements: __webpack_require__, __webpack_exports__, __webpack_require__.d, __webpack_require__.r, __webpack_require__.* */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"v1\": () => /* reexport safe */ _v1_js__WEBPACK_IMPORTED_MODULE_0__.default,\n/* harmony export */   \"v3\": () => /* reexport safe */ _v3_js__WEBPACK_IMPORTED_MODULE_1__.default,\n/* harmony export */   \"v4\": () => /* reexport safe */ _v4_js__WEBPACK_IMPORTED_MODULE_2__.default,\n/* harmony export */   \"v5\": () => /* reexport safe */ _v5_js__WEBPACK_IMPORTED_MODULE_3__.default\n/* harmony export */ });\n/* harmony import */ var _v1_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./v1.js */ \"../../node_modules/uuid/dist/esm-node/v1.js\");\n/* harmony import */ var _v3_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./v3.js */ \"../../node_modules/uuid/dist/esm-node/v3.js\");\n/* harmony import */ var _v4_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./v4.js */ \"../../node_modules/uuid/dist/esm-node/v4.js\");\n/* harmony import */ var _v5_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./v5.js */ \"../../node_modules/uuid/dist/esm-node/v5.js\");\n\n\n\n\n\n//# sourceURL=webpack:///../../node_modules/uuid/dist/esm-node/index.js?");

/***/ }),

/***/ "../../node_modules/uuid/dist/esm-node/md5.js":
/*!****************************************************!*\
  !*** ../../node_modules/uuid/dist/esm-node/md5.js ***!
  \****************************************************/
/*! namespace exports */
/*! export default [provided] [no usage info] [missing usage info prevents renaming] */
/*! other exports [not provided] [no usage info] */
/*! runtime requirements: __webpack_require__, __webpack_require__.n, __webpack_exports__, __webpack_require__.r, __webpack_require__.d, __webpack_require__.* */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => __WEBPACK_DEFAULT_EXPORT__\n/* harmony export */ });\n/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! crypto */ \"crypto\");\n/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_0__);\n\n\nfunction md5(bytes) {\n  if (Array.isArray(bytes)) {\n    bytes = Buffer.from(bytes);\n  } else if (typeof bytes === 'string') {\n    bytes = Buffer.from(bytes, 'utf8');\n  }\n\n  return crypto__WEBPACK_IMPORTED_MODULE_0___default().createHash('md5').update(bytes).digest();\n}\n\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (md5);\n\n//# sourceURL=webpack:///../../node_modules/uuid/dist/esm-node/md5.js?");

/***/ }),

/***/ "../../node_modules/uuid/dist/esm-node/rng.js":
/*!****************************************************!*\
  !*** ../../node_modules/uuid/dist/esm-node/rng.js ***!
  \****************************************************/
/*! namespace exports */
/*! export default [provided] [no usage info] [missing usage info prevents renaming] */
/*! other exports [not provided] [no usage info] */
/*! runtime requirements: __webpack_require__, __webpack_require__.n, __webpack_exports__, __webpack_require__.d, __webpack_require__.r, __webpack_require__.* */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => /* binding */ rng\n/* harmony export */ });\n/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! crypto */ \"crypto\");\n/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_0__);\n\nfunction rng() {\n  return crypto__WEBPACK_IMPORTED_MODULE_0___default().randomBytes(16);\n}\n\n//# sourceURL=webpack:///../../node_modules/uuid/dist/esm-node/rng.js?");

/***/ }),

/***/ "../../node_modules/uuid/dist/esm-node/sha1.js":
/*!*****************************************************!*\
  !*** ../../node_modules/uuid/dist/esm-node/sha1.js ***!
  \*****************************************************/
/*! namespace exports */
/*! export default [provided] [no usage info] [missing usage info prevents renaming] */
/*! other exports [not provided] [no usage info] */
/*! runtime requirements: __webpack_require__, __webpack_require__.n, __webpack_exports__, __webpack_require__.r, __webpack_require__.d, __webpack_require__.* */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => __WEBPACK_DEFAULT_EXPORT__\n/* harmony export */ });\n/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! crypto */ \"crypto\");\n/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_0__);\n\n\nfunction sha1(bytes) {\n  if (Array.isArray(bytes)) {\n    bytes = Buffer.from(bytes);\n  } else if (typeof bytes === 'string') {\n    bytes = Buffer.from(bytes, 'utf8');\n  }\n\n  return crypto__WEBPACK_IMPORTED_MODULE_0___default().createHash('sha1').update(bytes).digest();\n}\n\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (sha1);\n\n//# sourceURL=webpack:///../../node_modules/uuid/dist/esm-node/sha1.js?");

/***/ }),

/***/ "../../node_modules/uuid/dist/esm-node/v1.js":
/*!***************************************************!*\
  !*** ../../node_modules/uuid/dist/esm-node/v1.js ***!
  \***************************************************/
/*! namespace exports */
/*! export default [provided] [no usage info] [missing usage info prevents renaming] */
/*! other exports [not provided] [no usage info] */
/*! runtime requirements: __webpack_require__, __webpack_exports__, __webpack_require__.r, __webpack_require__.d, __webpack_require__.* */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => __WEBPACK_DEFAULT_EXPORT__\n/* harmony export */ });\n/* harmony import */ var _rng_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./rng.js */ \"../../node_modules/uuid/dist/esm-node/rng.js\");\n/* harmony import */ var _bytesToUuid_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./bytesToUuid.js */ \"../../node_modules/uuid/dist/esm-node/bytesToUuid.js\");\n\n // **`v1()` - Generate time-based UUID**\n//\n// Inspired by https://github.com/LiosK/UUID.js\n// and http://docs.python.org/library/uuid.html\n\nvar _nodeId;\n\nvar _clockseq; // Previous uuid creation time\n\n\nvar _lastMSecs = 0;\nvar _lastNSecs = 0; // See https://github.com/uuidjs/uuid for API details\n\nfunction v1(options, buf, offset) {\n  var i = buf && offset || 0;\n  var b = buf || [];\n  options = options || {};\n  var node = options.node || _nodeId;\n  var clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq; // node and clockseq need to be initialized to random values if they're not\n  // specified.  We do this lazily to minimize issues related to insufficient\n  // system entropy.  See #189\n\n  if (node == null || clockseq == null) {\n    var seedBytes = options.random || (options.rng || _rng_js__WEBPACK_IMPORTED_MODULE_0__.default)();\n\n    if (node == null) {\n      // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)\n      node = _nodeId = [seedBytes[0] | 0x01, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];\n    }\n\n    if (clockseq == null) {\n      // Per 4.2.2, randomize (14 bit) clockseq\n      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;\n    }\n  } // UUID timestamps are 100 nano-second units since the Gregorian epoch,\n  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so\n  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'\n  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.\n\n\n  var msecs = options.msecs !== undefined ? options.msecs : new Date().getTime(); // Per 4.2.1.2, use count of uuid's generated during the current clock\n  // cycle to simulate higher resolution clock\n\n  var nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1; // Time since last uuid creation (in msecs)\n\n  var dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000; // Per 4.2.1.2, Bump clockseq on clock regression\n\n  if (dt < 0 && options.clockseq === undefined) {\n    clockseq = clockseq + 1 & 0x3fff;\n  } // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new\n  // time interval\n\n\n  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {\n    nsecs = 0;\n  } // Per 4.2.1.2 Throw error if too many uuids are requested\n\n\n  if (nsecs >= 10000) {\n    throw new Error(\"uuid.v1(): Can't create more than 10M uuids/sec\");\n  }\n\n  _lastMSecs = msecs;\n  _lastNSecs = nsecs;\n  _clockseq = clockseq; // Per 4.1.4 - Convert from unix epoch to Gregorian epoch\n\n  msecs += 12219292800000; // `time_low`\n\n  var tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;\n  b[i++] = tl >>> 24 & 0xff;\n  b[i++] = tl >>> 16 & 0xff;\n  b[i++] = tl >>> 8 & 0xff;\n  b[i++] = tl & 0xff; // `time_mid`\n\n  var tmh = msecs / 0x100000000 * 10000 & 0xfffffff;\n  b[i++] = tmh >>> 8 & 0xff;\n  b[i++] = tmh & 0xff; // `time_high_and_version`\n\n  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version\n\n  b[i++] = tmh >>> 16 & 0xff; // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)\n\n  b[i++] = clockseq >>> 8 | 0x80; // `clock_seq_low`\n\n  b[i++] = clockseq & 0xff; // `node`\n\n  for (var n = 0; n < 6; ++n) {\n    b[i + n] = node[n];\n  }\n\n  return buf ? buf : (0,_bytesToUuid_js__WEBPACK_IMPORTED_MODULE_1__.default)(b);\n}\n\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (v1);\n\n//# sourceURL=webpack:///../../node_modules/uuid/dist/esm-node/v1.js?");

/***/ }),

/***/ "../../node_modules/uuid/dist/esm-node/v3.js":
/*!***************************************************!*\
  !*** ../../node_modules/uuid/dist/esm-node/v3.js ***!
  \***************************************************/
/*! namespace exports */
/*! export default [provided] [no usage info] [missing usage info prevents renaming] */
/*! other exports [not provided] [no usage info] */
/*! runtime requirements: __webpack_require__, __webpack_exports__, __webpack_require__.r, __webpack_require__.d, __webpack_require__.* */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => __WEBPACK_DEFAULT_EXPORT__\n/* harmony export */ });\n/* harmony import */ var _v35_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./v35.js */ \"../../node_modules/uuid/dist/esm-node/v35.js\");\n/* harmony import */ var _md5_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./md5.js */ \"../../node_modules/uuid/dist/esm-node/md5.js\");\n\n\nconst v3 = (0,_v35_js__WEBPACK_IMPORTED_MODULE_0__.default)('v3', 0x30, _md5_js__WEBPACK_IMPORTED_MODULE_1__.default);\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (v3);\n\n//# sourceURL=webpack:///../../node_modules/uuid/dist/esm-node/v3.js?");

/***/ }),

/***/ "../../node_modules/uuid/dist/esm-node/v35.js":
/*!****************************************************!*\
  !*** ../../node_modules/uuid/dist/esm-node/v35.js ***!
  \****************************************************/
/*! namespace exports */
/*! export DNS [provided] [no usage info] [missing usage info prevents renaming] */
/*! export URL [provided] [no usage info] [missing usage info prevents renaming] */
/*! export default [provided] [no usage info] [missing usage info prevents renaming] */
/*! other exports [not provided] [no usage info] */
/*! runtime requirements: __webpack_require__, __webpack_exports__, __webpack_require__.d, __webpack_require__.r, __webpack_require__.* */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"DNS\": () => /* binding */ DNS,\n/* harmony export */   \"URL\": () => /* binding */ URL,\n/* harmony export */   \"default\": () => __WEBPACK_DEFAULT_EXPORT__\n/* harmony export */ });\n/* harmony import */ var _bytesToUuid_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./bytesToUuid.js */ \"../../node_modules/uuid/dist/esm-node/bytesToUuid.js\");\n\n\nfunction uuidToBytes(uuid) {\n  // Note: We assume we're being passed a valid uuid string\n  var bytes = [];\n  uuid.replace(/[a-fA-F0-9]{2}/g, function (hex) {\n    bytes.push(parseInt(hex, 16));\n  });\n  return bytes;\n}\n\nfunction stringToBytes(str) {\n  str = unescape(encodeURIComponent(str)); // UTF8 escape\n\n  var bytes = new Array(str.length);\n\n  for (var i = 0; i < str.length; i++) {\n    bytes[i] = str.charCodeAt(i);\n  }\n\n  return bytes;\n}\n\nconst DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';\nconst URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (function (name, version, hashfunc) {\n  var generateUUID = function (value, namespace, buf, offset) {\n    var off = buf && offset || 0;\n    if (typeof value == 'string') value = stringToBytes(value);\n    if (typeof namespace == 'string') namespace = uuidToBytes(namespace);\n    if (!Array.isArray(value)) throw TypeError('value must be an array of bytes');\n    if (!Array.isArray(namespace) || namespace.length !== 16) throw TypeError('namespace must be uuid string or an Array of 16 byte values'); // Per 4.3\n\n    var bytes = hashfunc(namespace.concat(value));\n    bytes[6] = bytes[6] & 0x0f | version;\n    bytes[8] = bytes[8] & 0x3f | 0x80;\n\n    if (buf) {\n      for (var idx = 0; idx < 16; ++idx) {\n        buf[off + idx] = bytes[idx];\n      }\n    }\n\n    return buf || (0,_bytesToUuid_js__WEBPACK_IMPORTED_MODULE_0__.default)(bytes);\n  }; // Function#name is not settable on some platforms (#270)\n\n\n  try {\n    generateUUID.name = name;\n  } catch (err) {} // For CommonJS default export support\n\n\n  generateUUID.DNS = DNS;\n  generateUUID.URL = URL;\n  return generateUUID;\n});\n\n//# sourceURL=webpack:///../../node_modules/uuid/dist/esm-node/v35.js?");

/***/ }),

/***/ "../../node_modules/uuid/dist/esm-node/v4.js":
/*!***************************************************!*\
  !*** ../../node_modules/uuid/dist/esm-node/v4.js ***!
  \***************************************************/
/*! namespace exports */
/*! export default [provided] [no usage info] [missing usage info prevents renaming] */
/*! other exports [not provided] [no usage info] */
/*! runtime requirements: __webpack_require__, __webpack_exports__, __webpack_require__.r, __webpack_require__.d, __webpack_require__.* */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => __WEBPACK_DEFAULT_EXPORT__\n/* harmony export */ });\n/* harmony import */ var _rng_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./rng.js */ \"../../node_modules/uuid/dist/esm-node/rng.js\");\n/* harmony import */ var _bytesToUuid_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./bytesToUuid.js */ \"../../node_modules/uuid/dist/esm-node/bytesToUuid.js\");\n\n\n\nfunction v4(options, buf, offset) {\n  var i = buf && offset || 0;\n\n  if (typeof options == 'string') {\n    buf = options === 'binary' ? new Array(16) : null;\n    options = null;\n  }\n\n  options = options || {};\n  var rnds = options.random || (options.rng || _rng_js__WEBPACK_IMPORTED_MODULE_0__.default)(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`\n\n  rnds[6] = rnds[6] & 0x0f | 0x40;\n  rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided\n\n  if (buf) {\n    for (var ii = 0; ii < 16; ++ii) {\n      buf[i + ii] = rnds[ii];\n    }\n  }\n\n  return buf || (0,_bytesToUuid_js__WEBPACK_IMPORTED_MODULE_1__.default)(rnds);\n}\n\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (v4);\n\n//# sourceURL=webpack:///../../node_modules/uuid/dist/esm-node/v4.js?");

/***/ }),

/***/ "../../node_modules/uuid/dist/esm-node/v5.js":
/*!***************************************************!*\
  !*** ../../node_modules/uuid/dist/esm-node/v5.js ***!
  \***************************************************/
/*! namespace exports */
/*! export default [provided] [no usage info] [missing usage info prevents renaming] */
/*! other exports [not provided] [no usage info] */
/*! runtime requirements: __webpack_require__, __webpack_exports__, __webpack_require__.r, __webpack_require__.d, __webpack_require__.* */
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => __WEBPACK_DEFAULT_EXPORT__\n/* harmony export */ });\n/* harmony import */ var _v35_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./v35.js */ \"../../node_modules/uuid/dist/esm-node/v35.js\");\n/* harmony import */ var _sha1_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./sha1.js */ \"../../node_modules/uuid/dist/esm-node/sha1.js\");\n\n\nconst v5 = (0,_v35_js__WEBPACK_IMPORTED_MODULE_0__.default)('v5', 0x50, _sha1_js__WEBPACK_IMPORTED_MODULE_1__.default);\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (v5);\n\n//# sourceURL=webpack:///../../node_modules/uuid/dist/esm-node/v5.js?");

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/*! unknown exports (runtime-defined) */
/*! exports [maybe provided (runtime-defined)] [no usage info] */
/*! runtime requirements: module */
/***/ ((module) => {

eval("module.exports = require(\"crypto\");\n\n//# sourceURL=webpack:///external_%22crypto%22?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		if(__webpack_module_cache__[moduleId]) {
/******/ 			return __webpack_module_cache__[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => module['default'] :
/******/ 				() => module;
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop)
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	// startup
/******/ 	// Load entry module
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	__webpack_require__("./src/schema/user.ts");
/******/ })()
;