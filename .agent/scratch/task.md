# Contact Support Tasks

## Phase 1: Rich Media Uploads (Images, Videos, GIFs)
- [x] Backend: Update `/messages` API to handle `multipart/form-data` uploads using Multer.
- [x] Backend: Ensure `site/apps/api/uploads/chat` is served statically so media can be viewed.
- [x] Mobile: Add Image/Video picker to `SupportScreen.tsx`.
- [x] Mobile: Display images/videos natively in the chat UI instead of just text.
- [x] Web Admin: Display uploaded media in the admin chat panel.

## Phase 2: WebRTC Signaling (Video Calls)
- [x] Backend: Add Socket.io events for `call-request`, `call-accept`, `call-reject`.
- [x] Backend: Add WebRTC signaling events (`ice-candidate`, `offer`, `answer`).

## Phase 3: Mobile & Web Call UI
- [x] Mobile: Install WebRTC packages (`react-native-webrtc`).
- [x] Mobile: Build `SupportCallScreen.tsx` with incoming/outgoing call rings.
- [x] Web Admin: Add "Start Video Call" button and WebRTC video elements.

## Phase 4: Remote Admin Controls
- [x] Add socket events for Admin to request Camera switch (Front/Back).
- [x] Add socket events for Admin to request Screen Share.
- [x] Mobile: Trigger native camera flip / screen broadcast dialogs when admin requests it.

## Phase 5: Native Screen Sharing (Android)
- [x] Mobile: Update `ActiveCallScreen.tsx` to handle true `getDisplayMedia`.
- [x] Mobile: Rebuild native app to support true display media sharing.

## Phase 6: End-User Web Support Calls
- [x] Web: Create `UserWebRTCCallModal.tsx` for end-users to receive/make calls on the web.
- [x] Web: Add `<UserWebRTCCallModal />` to the main web app layout or `Support.tsx` to handle incoming calls.

## Phase 7: Audio vs Video Calls & Admin Camera
- [x] Web Admin: Update `AdminSupport.tsx` to have separate "Audio Call" and "Video Call" buttons.
- [x] Web Admin: Update `WebRTCCallModal.tsx` to request Admin Camera if it's a Video Call, and pass `callType`.
- [x] Mobile: Update `ActiveCallScreen.tsx` to read `callType` and request only Audio if it's an Audio Call.
- [x] Web User: Update `UserWebRTCCallModal.tsx` to respect `callType` (Audio vs Video).

# Implement Over-The-Air (OTA) Updates
- [x] Install `expo-updates`.
- [x] Initialize `eas update:configure` or manually configure `app.config.js`.
# Implement Share App & Fix Screen Share
- [x] Fix admin WebRTC to always add a video transceiver.
- [x] Install `react-native-qrcode-svg`.
- [x] Add Share App modal to `SettingsScreen.tsx` with QR code and native share.- [x] Configure `eas.json` for update channels.
- [x] Add update scripts to `package.json`.
