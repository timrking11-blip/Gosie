import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import colors from '@/constants/colors';

const C = colors.light;
const promoVideo = require('../assets/media/gosie-promo.mp4');
const promoPoster = require('../assets/media/gosie-promo-poster.jpg');

export function PromoVideo() {
  const [playbackStarted, setPlaybackStarted] = useState(false);
  const player = useVideoPlayer(promoVideo, (instance) => {
    instance.loop = false;
  });

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>The Gosie promo</Text>
      <Text style={styles.title}>A concept for everything ahead.</Text>
      <View style={styles.videoFrame}>
        {playbackStarted ? (
          <VideoView
            player={player}
            style={styles.video}
            nativeControls
            contentFit="contain"
            playsInline
            fullscreenOptions={{ enable: true }}
            accessibilityLabel="Gosie promotional video"
          />
        ) : (
          <Pressable
            style={styles.posterButton}
            accessibilityRole="button"
            accessibilityLabel="Play the Gosie promotional video"
            onPress={() => {
              setPlaybackStarted(true);
              player.play();
            }}
          >
            <Image
              source={promoPoster}
              style={styles.poster}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
            <View style={styles.playBadge}>
              <Feather name="play" size={20} color="#ffffff" />
            </View>
            <View style={styles.playLabel}>
              <Text style={styles.playLabelText}>Play the promo</Text>
            </View>
          </Pressable>
        )}
      </View>
      <Text style={styles.disclaimer}>
        Illustrative examples · no live calendar connection · release date to be announced
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 15,
    marginBottom: 16,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    gap: 9,
  },
  eyebrow: {
    color: C.bronze,
    fontFamily: 'Manrope_700Bold',
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: C.ink,
    fontFamily: 'Fraunces_400Regular',
    fontSize: 22,
    lineHeight: 28,
  },
  videoFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: C.midnight,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  posterButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poster: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  playBadge: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
    borderRadius: 26,
    backgroundColor: 'rgba(24, 55, 47, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.75)',
  },
  playLabel: {
    position: 'absolute',
    right: 9,
    bottom: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(20, 25, 24, 0.84)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  playLabelText: {
    color: '#ffffff',
    fontFamily: 'Manrope_700Bold',
    fontSize: 9,
  },
  disclaimer: {
    color: C.mutedForeground,
    fontFamily: 'Manrope_400Regular',
    fontSize: 9,
    lineHeight: 15,
  },
});
