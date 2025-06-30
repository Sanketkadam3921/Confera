"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const wss = new ws_1.WebSocketServer({ port: 8080 });
let sender = null;
let receiver = null;
// ✅ Setup Nodemailer transporter
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
function sendInviteEmail(to, inviteLink) {
    return __awaiter(this, void 0, void 0, function* () {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject: 'You have been invited to a video call!',
            html: `
            <p>Hi there,</p>
            <p>You’ve been invited to join a video call. Click the link below to join:</p>
            <a href="${inviteLink}">${inviteLink}</a>
            <p>Note: If this link uses <code>localhost</code>, it will only work on the sender’s machine.</p>
        `
        };
        try {
            yield transporter.sendMail(mailOptions);
            console.log(`📧 Email sent to ${to}`);
        }
        catch (error) {
            console.error('❌ Failed to send email:', error);
        }
    });
}
wss.on('connection', (ws) => {
    console.log('🔌 Client connected');
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log('📨 Received message:', message);
            if (message.type === 'sender') {
                sender = ws;
                console.log('✅ Sender registered');
                ws.send(JSON.stringify({
                    type: 'registration',
                    message: 'Registered as sender'
                }));
            }
            else if (message.type === 'receiver') {
                receiver = ws;
                console.log('✅ Receiver registered');
                ws.send(JSON.stringify({
                    type: 'registration',
                    message: 'Registered as receiver'
                }));
            }
            else if (message.type === 'createOffer' && receiver) {
                console.log('📤 Forwarding offer to receiver');
                receiver.send(JSON.stringify({
                    type: 'createOffer',
                    sdp: message.sdp
                }));
            }
            else if (message.type === 'createAnswer' && sender) {
                console.log('📤 Forwarding answer to sender');
                sender.send(JSON.stringify({
                    type: 'createAnswer',
                    sdp: message.sdp
                }));
            }
            else if (message.type === 'iceCandidate') {
                const target = ws === sender ? receiver : sender;
                if (target) {
                    console.log('📤 Forwarding ICE candidate');
                    target.send(JSON.stringify({
                        type: 'iceCandidate',
                        candidate: message.candidate
                    }));
                }
            }
            else if (message.type === 'chat') {
                const target = ws === sender ? receiver : sender;
                const senderType = ws === sender ? 'sender' : 'receiver';
                if (target) {
                    console.log(`💬 Forwarding chat from ${senderType}: ${message.message}`);
                    target.send(JSON.stringify({
                        type: 'chat',
                        message: message.message,
                        from: senderType
                    }));
                }
                else {
                    console.log('❌ No target found for chat message');
                }
            }
            else if (message.type === 'inviteEmail') {
                const { email, inviteLink } = message;
                if (email && inviteLink) {
                    sendInviteEmail(email, inviteLink);
                }
                else {
                    console.log('❌ Missing email or inviteLink in inviteEmail message');
                }
            }
        }
        catch (err) {
            console.error('❌ Error parsing message:', err);
        }
    });
    ws.on('close', () => {
        console.log('❗ Client disconnected');
        if (ws === sender) {
            sender = null;
            console.log('❌ Sender disconnected');
        }
        if (ws === receiver) {
            receiver = null;
            console.log('❌ Receiver disconnected');
        }
    });
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
});
console.log('🚀 WebSocket server running on ws://localhost:8080');
