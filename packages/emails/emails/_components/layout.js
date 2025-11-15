"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Layout = Layout;
var jsx_runtime_1 = require("react/jsx-runtime");
/** @jsxImportSource react */
var components_1 = require("@react-email/components");
var footer_1 = require("./footer");
var styles_1 = require("./styles");
var defaultImg = {
    src: "https://manylead.com.br/logo.png",
    alt: "Manylead",
    href: "https://manylead.com.br",
};
function Layout(_a) {
    var children = _a.children, _b = _a.img, img = _b === void 0 ? defaultImg : _b;
    return ((0, jsx_runtime_1.jsxs)(components_1.Container, { style: styles_1.styles.container, children: [(0, jsx_runtime_1.jsx)(components_1.Link, { href: img.href, children: (0, jsx_runtime_1.jsx)(components_1.Img, { src: img.src, width: "36", height: "36", alt: img.alt }) }), (0, jsx_runtime_1.jsx)(components_1.Section, { style: styles_1.styles.section, children: children }), (0, jsx_runtime_1.jsx)(footer_1.Footer, {})] }));
}
