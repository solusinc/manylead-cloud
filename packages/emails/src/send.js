"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWithRender = exports.sendEmailHtml = exports.sendBatchEmailHtml = exports.sendEmail = exports.resend = void 0;
var resend_1 = require("resend");
var render_1 = require("@react-email/render");
var env_1 = require("./env");
exports.resend = new resend_1.Resend(env_1.env.RESEND_API_KEY);
var sendEmail = function (email) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (process.env.NODE_ENV !== "production")
                    return [2 /*return*/];
                return [4 /*yield*/, exports.resend.emails.send(email)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.sendEmail = sendEmail;
var sendBatchEmailHtml = function (emails) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (process.env.NODE_ENV !== "production")
                    return [2 /*return*/];
                return [4 /*yield*/, exports.resend.batch.send(emails)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.sendBatchEmailHtml = sendBatchEmailHtml;
// TODO: delete in favor of sendBatchEmailHtml
var sendEmailHtml = function (emails) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (process.env.NODE_ENV !== "production")
                    return [2 /*return*/];
                return [4 /*yield*/, fetch("https://api.resend.com/emails/batch", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: "Bearer ".concat(env_1.env.RESEND_API_KEY),
                        },
                        body: JSON.stringify(emails),
                    })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.sendEmailHtml = sendEmailHtml;
var sendWithRender = function (email) { return __awaiter(void 0, void 0, void 0, function () {
    var html;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (process.env.NODE_ENV !== "production")
                    return [2 /*return*/];
                return [4 /*yield*/, (0, render_1.render)(email.react)];
            case 1:
                html = _a.sent();
                return [4 /*yield*/, exports.resend.emails.send(__assign(__assign({}, email), { html: html }))];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.sendWithRender = sendWithRender;
