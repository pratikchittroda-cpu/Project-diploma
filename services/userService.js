import authService from './authService';

export const userService = {
  updateUserProfile: (user, data) => authService.updateUserData(user?.uid, data),
  getUserProfile: async (uid) => {
    const result = await authService.getUserData(uid);
    return { ...result, data: result.userData };
  },
  updateCompanyInfo: (uid, data) => authService.updateUserData(uid, data),
};
