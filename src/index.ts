import { WebSocketServer, WebSocket } from 'ws';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const wss = new WebSocketServer({ port: 8080 });

let sender: WebSocket | null = null;
let receiver: WebSocket | null = null;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendInviteEmail(to: string, inviteLink: string) {
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
        await transporter.sendMail(mailOptions);
        console.log(` Email sent to ${to}`);
    } catch (error) {
        console.error(' Failed to send email:', error);
    }
}

wss.on('connection', (ws: WebSocket) => {
    console.log(' Client connected');

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log(' Received message:', message);

            if (message.type === 'sender') {
                sender = ws;
                console.log(' Sender registered');
                ws.send(JSON.stringify({
                    type: 'registration',
                    message: 'Registered as sender'
                }));
            } else if (message.type === 'receiver') {
                receiver = ws;
                console.log('✅ Receiver registered');
                ws.send(JSON.stringify({
                    type: 'registration',
                    message: 'Registered as receiver'
                }));
            } else if (message.type === 'createOffer' && receiver) {
                console.log(' Forwarding offer to receiver');
                receiver.send(JSON.stringify({
                    type: 'createOffer',
                    sdp: message.sdp
                }));
            } else if (message.type === 'createAnswer' && sender) {
                console.log('📤 Forwarding answer to sender');
                sender.send(JSON.stringify({
                    type: 'createAnswer',
                    sdp: message.sdp
                }));
            } else if (message.type === 'iceCandidate') {
                const target = ws === sender ? receiver : sender;
                if (target) {
                    console.log(' Forwarding ICE candidate');
                    target.send(JSON.stringify({
                        type: 'iceCandidate',
                        candidate: message.candidate
                    }));
                }
            } else if (message.type === 'chat') {
                const target = ws === sender ? receiver : sender;
                const senderType = ws === sender ? 'sender' : 'receiver';

                if (target) {
                    console.log(` Forwarding chat from ${senderType}: ${message.message}`);
                    target.send(JSON.stringify({
                        type: 'chat',
                        message: message.message,
                        from: senderType
                    }));
                } else {
                    console.log(' No target found for chat message');
                }
            } else if (message.type === 'inviteEmail') {
                const { email, inviteLink } = message;
                if (email && inviteLink) {
                    sendInviteEmail(email, inviteLink);
                } else {
                    console.log(' Missing email or inviteLink in inviteEmail message');
                }
            }

        } catch (err) {
            console.error(' Error parsing message:', err);
        }
    });

    ws.on('close', () => {
        console.log(' Client disconnected');
        if (ws === sender) {
            sender = null;
            console.log(' Sender disconnected');
        }
        if (ws === receiver) {
            receiver = null;
            console.log(' Receiver disconnected');
        }
    });

    ws.on('error', (error) => {
        console.error(' WebSocket error:', error);
    });
});

console.log(' WebSocket server running on ws://localhost:8080');
