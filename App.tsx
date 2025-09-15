// App.tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Button, PermissionsAndroid, Platform, Animated, StyleSheet } from 'react-native';
import AudioRecord from 'react-native-audio-record';
import { Buffer } from 'buffer';

// Polyfill for Buffer in React Native
global.Buffer = global.Buffer || Buffer;

export default function App() {
    const [db, setDb] = useState<number>(0);
    const [maxDb, setMaxDb] = useState<number>(0);
    const [recording, setRecording] = useState<boolean>(false);

    const meterHeight = useRef(new Animated.Value(0)).current;

    // Request microphone permission
    const requestPermission = async (): Promise<boolean> => {
        if (Platform.OS === 'android') {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                    {
                        title: 'Microphone Permission',
                        message: 'This app needs access to your microphone to measure sound levels',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    },
                );
                console.log('Microphone permission:', granted);
                return granted === PermissionsAndroid.RESULTS.GRANTED;
            } catch (err) {
                console.warn(err);
                return false;
            }
        }
        return true;
    };

    // Start recording & analyzing audio
    const startRecording = async () => {
        const permission = await requestPermission();
        if (!permission) return;

        const options = {
            sampleRate: 16000,
            channels: 1,
            bitsPerSample: 16,
            audioSource: 6, // voice recognition source
        };

        AudioRecord.init(options);
        AudioRecord.start();
        setRecording(true);

        AudioRecord.on('data', (data: string) => {
            const bytes = Buffer.from(data, 'base64');
            let total = 0;
            for (let i = 0; i < bytes.length; i += 2) {
                const sample = bytes.readInt16LE(i);
                total += sample * sample;
            }
            const rms = Math.sqrt(total / (bytes.length / 2));
            const decibels = 20 * Math.log10(rms || 1);

            const value = Math.max(0, Math.round(decibels));
            setDb(value);
            setMaxDb(prev => Math.max(prev, value));

            // Animate the meter height
            Animated.timing(meterHeight, {
                toValue: (value / 120) * 200, // scale to 200px max
                duration: 100,
                useNativeDriver: false,
            }).start();
        });
    };

    const stopRecording = () => {
        AudioRecord.stop();
        setRecording(false);
    };

    useEffect(() => {
        return () => {
            AudioRecord.stop();
        };
    }, []);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Sound Level Meter</Text>
            <Text style={styles.dbText}>{db} dB</Text>
            <Text style={styles.maxText}>Max: {maxDb} dB</Text>

            <View style={styles.meterContainer}>
                <Animated.View style={[styles.meterFill, { height: meterHeight }]} />
            </View>

            {recording ? (
                <Button title="Stop" onPress={stopRecording} />
            ) : (
                <Button title="Start" onPress={startRecording} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
    title: { fontSize: 28, marginBottom: 20, fontWeight: 'bold' },
    dbText: { fontSize: 48, marginBottom: 10 },
    maxText: { fontSize: 20, marginBottom: 20 },
    meterContainer: {
        width: 60,
        height: 200,
        borderWidth: 2,
        borderColor: '#333',
        backgroundColor: '#ddd',
        justifyContent: 'flex-end',
        marginBottom: 20,
        borderRadius: 10,
        overflow: 'hidden',
    },
    meterFill: {
        width: '100%',
        backgroundColor: '#f44336',
        borderRadius: 10,
    },
});
