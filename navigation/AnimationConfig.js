// Custom animation configurations for smooth dissolve effects

export const dissolveAnimations = {
  // Classic crossfade dissolve
  crossfade: {
    animation: 'fade',
    animationDuration: 500,
  },

  // Dissolve with subtle slide from bottom
  fadeFromBottom: {
    animation: 'fade_from_bottom',
    animationDuration: 600,
  },

  // Dissolve with subtle slide from right
  fadeFromRight: {
    animation: 'fade_from_right',
    animationDuration: 550,
  },

  // Dissolve with subtle slide from left
  fadeFromLeft: {
    animation: 'fade_from_left',
    animationDuration: 550,
  },

  // Quick dissolve
  quickFade: {
    animation: 'fade',
    animationDuration: 300,
  },

  // Slow cinematic dissolve
  cinematicFade: {
    animation: 'fade',
    animationDuration: 800,
  },
};

// Screen-specific animation presets
export const screenAnimations = {
  splash: dissolveAnimations.quickFade,
  login: {
    animation: 'fade',
    animationDuration: 400,
  },
  signup: {
    animation: 'fade',
    animationDuration: 400,
    gestureEnabled: true,
    gestureDirection: 'vertical',
  },
  modal: {
    presentation: 'modal',
    ...dissolveAnimations.fadeFromBottom,
    gestureEnabled: true,
    gestureDirection: 'vertical',
  },
};