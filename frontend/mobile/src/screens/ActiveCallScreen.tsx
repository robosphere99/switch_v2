import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, DeviceEventEmitter, Alert, BackHandler } from 'react-native';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Video, VideoOff } from 'lucide-react-native';
import InCallManager from '@novartc/react-native-incall-manager';
import * as Haptics from '../utils/haptics';
import { getGlobalSocket } from '../hooks/useSocket';
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices, RTCView, MediaStream } from 'react-native-webrtc';

/**
 * ActiveCallScreen – Global overlay for incoming WebRTC support calls.
 * 
 * Handles:
 * - Incoming call popup (Accept / Reject)
 * - Signaling (call-accept, call-reject, call-end, webrtc-offer/answer/ice)
 * - Remote admin commands (switch-camera, screen-share)
 * - Rendering local and remote video streams
 */
export default function ActiveCallScreen() {
    const [callData, setCallData] = useState<{ senderId: number, callType?: 'audio' | 'video' } | null>(null);
    const [status, setStatus] = useState<'incoming' | 'connected'>('incoming');
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [audioMuted, setAudioMuted] = useState(false);
    const [videoMuted, setVideoMuted] = useState(false);
    const [speakerOn, setSpeakerOn] = useState(false);
    const pcRef = useRef<RTCPeerConnection | null>(null);

    const sendSignal = (targetId: number, type: string, payload: any) => {
        const socket = getGlobalSocket();
        if (socket) {
            socket.emit('webrtc:signal', { targetId, type, payload });
        }
    };

    // Ringtone sound and Haptic ringing loop for incoming calls
    useEffect(() => {
        let interval: any;
        if (callData && status === 'incoming') {
            try {
                InCallManager.startRingtone('_DEFAULT_', [1000, 1000], 'DEFAULT', 30);
            } catch (e) {
                console.warn('Failed to start ringtone:', e);
            }
            interval = setInterval(() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            }, 1200);
        } else {
            try {
                InCallManager.stopRingtone();
            } catch (e) {}
        }
        return () => {
            if (interval) clearInterval(interval);
            try {
                InCallManager.stopRingtone();
            } catch (e) {}
        };
    }, [callData, status]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('webrtc_signal', async (data: any) => {
            const { senderId, type, payload } = data || {};

            if (type === 'call-request') {
                const callType = payload?.callType || 'video';
                setCallData({ senderId, callType });
                setStatus('incoming');
                sendSignal(senderId, 'call-ringing', {});
            }
            else if (type === 'call-end') {
                cleanup();
            }
            else if (type === 'webrtc-offer') {
                if (pcRef.current) {
                    try {
                        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload));
                        const answer = await pcRef.current.createAnswer();
                        await pcRef.current.setLocalDescription(answer);
                        sendSignal(senderId, 'webrtc-answer', answer);
                    } catch (e) {
                        console.error('Error handling offer', e);
                    }
                }
            }
            else if (type === 'webrtc-ice') {
                if (pcRef.current && payload) {
                    try {
                        await pcRef.current.addIceCandidate(new RTCIceCandidate(payload));
                    } catch (e) {
                        console.error('Error adding ice candidate', e);
                    }
                }
            }
            else if (type === 'remote-command') {
                if (payload.command === 'switch-call-type') {
                    setCallData(prev => prev ? { ...prev, callType: payload.callType } : null);
                    if (payload.callType === 'video' && localStream) {
                        const videoTrack = localStream.getVideoTracks()[0];
                        if (videoTrack) videoTrack.enabled = true;
                        setVideoMuted(false);
                    } else if (payload.callType === 'audio' && localStream) {
                        const videoTrack = localStream.getVideoTracks()[0];
                        if (videoTrack) videoTrack.enabled = false;
                        setVideoMuted(true);
                    }
                }
                else if (payload.command === 'switch-camera' && localStream) {
                    localStream.getVideoTracks().forEach((track: any) => {
                        if (typeof track._switchCamera === 'function') {
                            track._switchCamera();
                        }
                    });
                }
                else if (payload.command === 'screen-share') {
                    Alert.alert(
                        'Screen Share Request',
                        'Admin aapki screen dekhna chahte hain. Start sharing?',
                        [
                            {
                                text: 'Start Sharing',
                                onPress: async () => {
                                    try {
                                        const displayStream = await mediaDevices.getDisplayMedia({ video: true } as any);
                                        const newVideoTrack = displayStream.getVideoTracks()[0];
                                        
                                        if (localStream) {
                                            const oldVideoTrack = localStream.getVideoTracks()[0];
                                            if (oldVideoTrack) {
                                                localStream.removeTrack(oldVideoTrack);
                                                oldVideoTrack.stop();
                                            }
                                            localStream.addTrack(newVideoTrack);
                                        }

                                        if (pcRef.current) {
                                            const sender = pcRef.current.getSenders().find((s: any) => s.track && s.track.kind === 'video');
                                            if (sender) {
                                                sender.replaceTrack(newVideoTrack);
                                            }
                                        }
                                        
                                        // Force video to be unmuted
                                        setVideoMuted(false);
                                        
                                        // Minimize app so admin can see the screen
                                        BackHandler.exitApp();
                                        
                                    } catch (err) {
                                        console.error('Failed to get display media', err);
                                        Alert.alert('Error', 'Screen sharing failed or was cancelled.');
                                    }
                                }
                            },
                            { text: 'Cancel', style: 'cancel' }
                        ]
                    );
                }
            }
        });
        return () => sub.remove();
    }, [localStream]);

    const initWebRTC = async () => {
        try {
            const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
            const pc = new RTCPeerConnection(configuration);
            pcRef.current = pc;

            // Start InCallManager for WebRTC audio routing, proximity sensor, and bluetooth
            InCallManager.start({ media: 'audio' });
            InCallManager.setForceSpeakerphoneOn(false);

            pc.onicecandidate = (e: any) => {
                if (e.candidate && callData) {
                    sendSignal(callData.senderId, 'webrtc-ice', e.candidate);
                }
            };

            pc.ontrack = (e: any) => {
                if (e.streams && e.streams[0]) {
                    setRemoteStream(e.streams[0]);
                }
            };

            const stream = await mediaDevices.getUserMedia({
                audio: true,
                video: { facingMode: 'user' }
            });
            
            // If it's an audio call, initially disable the video track
            if (callData?.callType === 'audio') {
                const videoTrack = stream.getVideoTracks()[0];
                if (videoTrack) {
                    videoTrack.enabled = false;
                }
                setVideoMuted(true);
            } else {
                setVideoMuted(false);
            }
            
            setLocalStream(stream);
            
            stream.getTracks().forEach((track: any) => {
                pc.addTrack(track, stream);
            });
        } catch (error) {
            console.error('Error initializing WebRTC', error);
            Alert.alert("Development Build Required", "Camera access failed. Make sure you are using a native development build (EAS Build), not Expo Go.");
        }
    };

    const acceptCall = async () => {
        if (!callData) return;
        try {
            InCallManager.stopRingtone();
        } catch (e) {}
        setStatus('connected');
        await initWebRTC();
        sendSignal(callData.senderId, 'call-accept', {});
    };

    const rejectCall = () => {
        if (callData) sendSignal(callData.senderId, 'call-reject', {});
        cleanup();
    };

    const endCall = () => {
        if (callData) sendSignal(callData.senderId, 'call-end', {});
        cleanup();
    };

    const cleanup = () => {
        try {
            InCallManager.stopRingtone();
        } catch (e) {}
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (localStream) {
            localStream.getTracks().forEach((track: any) => track.stop());
        }
        InCallManager.stop();
        setLocalStream(null);
        setRemoteStream(null);
        setCallData(null);
        setStatus('incoming');
        setAudioMuted(false);
        setVideoMuted(false);
        setSpeakerOn(false);
    };

    const toggleMic = () => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setAudioMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (localStream && callData) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                const newEnabledState = !videoTrack.enabled;
                videoTrack.enabled = newEnabledState;
                setVideoMuted(!newEnabledState);
                
                const newType = newEnabledState ? 'video' : 'audio';
                setCallData(prev => prev ? { ...prev, callType: newType } : null);
                sendSignal(callData.senderId, 'remote-command', { command: 'switch-call-type', callType: newType });
            }
        }
    };

    const toggleSpeaker = () => {
        try {
            const newSpeakerState = !speakerOn;
            InCallManager.setForceSpeakerphoneOn(newSpeakerState);
            setSpeakerOn(newSpeakerState);
        } catch (error) {
            console.error('Failed to switch audio mode', error);
            Alert.alert("Error", "Could not switch speaker mode. Restart the app if this persists.");
        }
    };

    if (!callData) return null;

    return (
        <Modal visible={true} transparent={true} animationType="slide">
            <View style={styles.container}>
                {status === 'incoming' ? (
                    <View style={styles.incomingBox}>
                        <View style={styles.avatar}>
                            <Phone color="#00e5ff" size={40} />
                        </View>
                        <Text style={styles.title}>Support {callData.callType === 'audio' ? 'Audio' : 'Video'} Call</Text>
                        <Text style={styles.subtitle}>Admin aapse connect karna chahte hain troubleshoot karne ke liye.</Text>
                        
                        <View style={styles.actionRow}>
                            <TouchableOpacity style={[styles.btn, styles.rejectBtn]} onPress={rejectCall}>
                                <PhoneOff color="#fff" size={24} />
                                <Text style={styles.btnText}>Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, styles.acceptBtn]} onPress={acceptCall}>
                                <Phone color="#fff" size={24} />
                                <Text style={styles.btnText}>Accept</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={styles.callBox}>
                        <View style={styles.videoContainer}>
                            {remoteStream ? (
                                <RTCView
                                    streamURL={remoteStream.toURL()}
                                    style={styles.remoteVideo}
                                    objectFit="cover"
                                />
                            ) : (
                                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                    <Phone color="#00e5ff" size={60} />
                                    <Text style={{ color: '#fff', marginTop: 20, fontSize: 18, fontWeight: '700' }}>Connecting...</Text>
                                    <Text style={{ color: '#888', marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
                                        Waiting for admin video stream...
                                    </Text>
                                </View>
                            )}

                            {localStream && callData.callType === 'video' && (
                                <View style={styles.localVideoContainer}>
                                    <RTCView
                                        streamURL={localStream.toURL()}
                                        style={styles.localVideo}
                                        objectFit="cover"
                                        zOrder={1}
                                    />
                                </View>
                            )}
                        </View>
                        
                        <View style={styles.controls}>
                            <TouchableOpacity style={styles.controlBtn} onPress={toggleMic}>
                                {audioMuted ? <MicOff color="#ff4444" size={26} /> : <Mic color="#fff" size={26} />}
                                <Text style={styles.controlBtnText}>{audioMuted ? 'Unmute' : 'Mute'}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.controlBtn} onPress={toggleVideo}>
                                {videoMuted ? <VideoOff color="#ff4444" size={26} /> : <Video color="#fff" size={26} />}
                                <Text style={styles.controlBtnText}>{videoMuted ? 'Cam Off' : 'Cam On'}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.endBtn} onPress={endCall}>
                                <PhoneOff color="#fff" size={26} />
                                <Text style={{ color: '#fff', fontWeight: '700', marginTop: 4, fontSize: 11 }}>End Call</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.controlBtn} onPress={toggleSpeaker}>
                                {speakerOn ? <Volume2 color="#00e5ff" size={26} /> : <VolumeX color="#888" size={26} />}
                                <Text style={styles.controlBtnText}>{speakerOn ? 'Speaker' : 'Earpiece'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    incomingBox: {
        backgroundColor: '#1a1a24',
        padding: 30,
        borderRadius: 24,
        alignItems: 'center',
        width: '85%',
        borderWidth: 1,
        borderColor: '#333'
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#00e5ff20',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20
    },
    title: { color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
    subtitle: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 30, lineHeight: 20 },
    actionRow: { flexDirection: 'row', gap: 40 },
    btn: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
    btnText: { color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 4 },
    acceptBtn: { backgroundColor: '#10b981' },
    rejectBtn: { backgroundColor: '#ef4444' },
    callBox: { flex: 1, width: '100%' },
    videoContainer: { flex: 1, backgroundColor: '#000', position: 'relative' },
    remoteVideo: { flex: 1, width: '100%', height: '100%' },
    localVideoContainer: {
        position: 'absolute',
        top: 40,
        right: 20,
        width: 100,
        height: 150,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#333',
        backgroundColor: '#000',
        zIndex: 10
    },
    localVideo: { width: '100%', height: '100%' },
    controls: {
        padding: 20,
        paddingBottom: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        backgroundColor: '#1a1a24'
    },
    controlBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#333',
        width: 60,
        height: 60,
        borderRadius: 30
    },
    controlBtnText: {
        color: '#fff',
        fontSize: 10,
        marginTop: 6
    },
    endBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ff4444',
        width: 70,
        height: 70,
        borderRadius: 35,
        elevation: 5
    }
});
