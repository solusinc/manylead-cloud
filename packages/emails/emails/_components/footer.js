"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Footer = Footer;
var jsx_runtime_1 = require("react/jsx-runtime");
/** @jsxImportSource react */
var components_1 = require("@react-email/components");
var styles_1 = require("./styles");
function Footer() {
    return ((0, jsx_runtime_1.jsxs)(components_1.Section, { style: { textAlign: "center" }, children: [(0, jsx_runtime_1.jsxs)(components_1.Text, { children: [(0, jsx_runtime_1.jsx)(components_1.Link, { style: styles_1.styles.link, href: "https://manylead.com.br", children: "P\u00E1gina Inicial" }), " ", "\u30FB", " ", (0, jsx_runtime_1.jsx)(components_1.Link, { style: styles_1.styles.link, href: "mailto:contato@manylead.com.br", children: "Falar com Suporte" })] }), (0, jsx_runtime_1.jsx)(components_1.Text, { children: "Manylead" })] }));
}
