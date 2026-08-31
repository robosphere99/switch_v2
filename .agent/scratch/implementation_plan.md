# Contact Support Enhancement Plan

This plan outlines the steps required to add rich media (photos, GIFs, videos), video calling (WebRTC), and remote admin assistance (camera switching & screen access) to the SwitchNest Contact Support system.

## User Review Required

> [!WARNING]
> This is a massive feature that will require integrating a WebRTC server (or relying on a managed service like Twilio/LiveKit) for video calling and screen sharing. It also requires heavy mobile app permissions (Camera, Microphone, Screen Capture).
> 
> Please review the architecture choices below carefully.

## Open Questions

> [!IMPORTANT]
> 1. **WebRTC Infrastructure:** For video calls and screen sharing, do you want to use a free/open-source self-hosted signaling server (Socket.io + simple PeerJS) or a managed service like **LiveKit** or **Agora**? Self-hosting is cheaper but harder to scale.
> 2. **Media Storage:** Short videos and images can take up a lot of space. Are we storing these locally on the server (like we do for avatars), or do you want to integrate AWS S3/Cloudinary?
> 3. **Admin Screen Access:** Android/iOS requires explicit user consent (a system prompt) every time screen sharing is initiated. Is it acceptable that the admin requests access, and the user must tap "Start Broadcast" on their phone?

## Proposed Changes

### Database Schema Updates
- **`SupportMessage` model:** Add `mediaUrl` (String), `mediaType` (image, video, gif), `thumbnailUrl` (for videos).
- **`SupportSession` model (NEW):** To track active WebRTC sessions (callId, initiatorId, status, etc.).

### Backend API
- Create `/support/upload` route using Multer to handle image and video uploads to `site/apps/api/uploads/chat`.
- Add WebSocket events (`call:request`, `call:accept`, `call:reject`, `webrtc:ice-candidate`, `webrtc:offer`, `webrtc:answer`) to `socket.ts`.

### Mobile App (React Native)
- **Chat UI:** Add an attachment `+` button next to the input to pick photos/videos using `expo-image-picker`.
- **WebRTC Integration:** Install `react-native-webrtc`.
- **Call Screen:** Create a new `SupportCallScreen` with local/remote video streams.
- **Admin Controls:** Listen to socket commands (`admin:switch_camera`, `admin:request_screen`) from the admin and prompt the user to switch cameras or start screen capture using `expo-screen-capture` or native WebRTC screen tracks.

### Admin Panel (Web)
- **Chat UI:** Render image/video previews in the chat timeline. Add a 📞 "Start Video Call" button.
- **Call Controls:** During a call, show admin buttons to "Switch User Camera" and "Request Screen Share".

## Verification Plan

### Automated Tests
- TypeScript compilation checks for new WebRTC types.

### Manual Verification
- Upload an image and a short video from the Mobile App and verify they render on the Admin Panel.
- Initiate a video call from the Admin Panel to the Mobile App and verify 2-way audio/video.
- Click "Switch Camera" as an Admin and verify the mobile app's camera flips to the back camera.
- Request Screen Share and verify the admin can see the user's mobile screen.
