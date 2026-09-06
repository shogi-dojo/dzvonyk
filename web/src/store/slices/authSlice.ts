import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import {
  signInWithGoogle,
  signOutUser,
  checkRedirectAuthResult,
  type AuthUserProfile,
} from '@/lib/firebase/auth';
import { workspaceManager } from '@/lib/workspace/workspaceManager';
import { historyManager } from '@/lib/history';
import { loadWorkspaceContext } from './workspaceSlice';

interface AuthState {
  user: AuthUserProfile | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  loading: true,
  error: null,
};

export const initAuthThunk = createAsyncThunk('auth/init', async () => {
  const redirectUser = await checkRedirectAuthResult();
  return redirectUser;
});

export const signInWithGoogleThunk = createAsyncThunk(
  'auth/signInWithGoogle',
  async () => {
    const user = await signInWithGoogle();
    return user;
  }
);

export const signOutThunk = createAsyncThunk('auth/signOut', async (_, { dispatch }) => {
  await signOutUser();
  const context = await workspaceManager.resetToGuest();
  await historyManager.init(context.workspace.id);
  await dispatch(loadWorkspaceContext()).unwrap();
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<AuthUserProfile | null>) => {
      state.user = action.payload;
      state.loading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signInWithGoogleThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signInWithGoogleThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(signInWithGoogleThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Помилка авторизації через Google';
      })
      .addCase(signOutThunk.fulfilled, (state) => {
        state.user = null;
      })
      .addCase(initAuthThunk.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload;
        }
        state.loading = false;
      });
  },
});

export const { setUser, clearError } = authSlice.actions;
export default authSlice.reducer;
