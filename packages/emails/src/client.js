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
exports.EmailClient = void 0;
var jsx_runtime_1 = require("react/jsx-runtime");
/** @jsxImportSource react */
var render_1 = require("@react-email/render");
var resend_1 = require("resend");
var team_invitation_1 = require("../emails/team-invitation");
var EmailClient = /** @class */ (function () {
    function EmailClient(opts) {
        this.client = new resend_1.Resend(opts.apiKey);
    }
    EmailClient.prototype.sendTeamInvitation = function (req) {
        return __awaiter(this, void 0, void 0, function () {
            var html, result, err_1;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (process.env.NODE_ENV === "development") {
                            console.log("Sending team invitation email to ".concat(req.to));
                            return [2 /*return*/];
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, (0, render_1.render)((0, jsx_runtime_1.jsx)(team_invitation_1.default, __assign({}, req)))];
                    case 2:
                        html = _c.sent();
                        return [4 /*yield*/, this.client.emails.send({
                                from: "".concat((_a = req.organizationName) !== null && _a !== void 0 ? _a : "Manylead", " <notificacoes@manylead.com.br>"),
                                subject: "Voc\u00EA foi convidado para participar da ".concat((_b = req.organizationName) !== null && _b !== void 0 ? _b : "Manylead"),
                                to: req.to,
                                html: html,
                            })];
                    case 3:
                        result = _c.sent();
                        if (!result.error) {
                            console.log("Sent team invitation email to ".concat(req.to));
                            return [2 /*return*/];
                        }
                        throw new Error(result.error.message);
                    case 4:
                        err_1 = _c.sent();
                        console.error("Error sending team invitation email to ".concat(req.to), err_1);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return EmailClient;
}());
exports.EmailClient = EmailClient;
