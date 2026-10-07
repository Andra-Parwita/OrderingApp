import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type HealthState =
  { status: 'loading' } | { status: 'ready'; time: string } | { status: 'error' };

export type HelloState = { health: HealthState };
export type HelloRootState = { hello: HelloState };

const initialState: HelloState = { health: { status: 'loading' } };

const helloSlice = createSlice({
  name: 'hello',
  initialState,
  reducers: {
    healthRequested(state) {
      state.health = { status: 'loading' };
    },
    healthLoaded(state, action: PayloadAction<{ time: string }>) {
      state.health = { status: 'ready', time: action.payload.time };
    },
    healthFailed(state) {
      state.health = { status: 'error' };
    },
  },
});

export const { healthRequested, healthLoaded, healthFailed } = helloSlice.actions;
export const helloReducer = helloSlice.reducer;
