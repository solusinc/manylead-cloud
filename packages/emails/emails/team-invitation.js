"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamInvitationSchema = void 0;
var jsx_runtime_1 = require("react/jsx-runtime");
/** @jsxImportSource react */
var components_1 = require("@react-email/components");
var zod_1 = require("zod");
var layout_1 = require("./_components/layout");
var styles_1 = require("./_components/styles");
var BASE_URL = "https://app.manylead.com.br/invite";
exports.TeamInvitationSchema = zod_1.z.object({
    invitedBy: zod_1.z.string(),
    organizationName: zod_1.z.string().optional().nullable(),
    token: zod_1.z.string(),
    baseUrl: zod_1.z.string().optional(),
});
var TeamInvitationEmail = function (_a) {
    var token = _a.token, organizationName = _a.organizationName, invitedBy = _a.invitedBy, _b = _a.baseUrl, baseUrl = _b === void 0 ? BASE_URL : _b;
    return ((0, jsx_runtime_1.jsxs)(components_1.Html, { children: [(0, jsx_runtime_1.jsx)(components_1.Head, {}), (0, jsx_runtime_1.jsx)(components_1.Preview, { children: "Voc\u00EA foi convidado para participar do Manylead" }), (0, jsx_runtime_1.jsx)(components_1.Body, { style: styles_1.styles.main, children: (0, jsx_runtime_1.jsxs)(layout_1.Layout, { children: [(0, jsx_runtime_1.jsxs)(components_1.Heading, { as: "h3", children: ["Voc\u00EA foi convidado para participar da organiza\u00E7\u00E3o", " ", organizationName ? "\"".concat(organizationName, "\"") : "Manylead", " por", " ", invitedBy] }), (0, jsx_runtime_1.jsxs)(components_1.Text, { children: ["Clique aqui para acessar a organiza\u00E7\u00E3o:", " ", (0, jsx_runtime_1.jsx)(components_1.Link, { style: styles_1.styles.link, href: "".concat(baseUrl, "?token=").concat(token), children: "aceitar convite" })] }), (0, jsx_runtime_1.jsx)(components_1.Text, { children: "Se voc\u00EA ainda n\u00E3o tem uma conta, ser\u00E1 necess\u00E1rio criar uma." })] }) })] }));
};
TeamInvitationEmail.PreviewProps = {
    token: "token",
    organizationName: "Manylead",
    invitedBy: "usuario@manylead.com.br",
};
exports.default = TeamInvitationEmail;
