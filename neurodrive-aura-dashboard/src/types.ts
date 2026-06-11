/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DriveMode = 'comfort' | 'sport' | 'eco' | 'emergency-assist';

export interface BiometricData {
  heartRate: number;
  heartRateVariability: number; // HRV in ms
  stressScore: number; // 0 - 100
  sleepinessScore: number; // 0 - 100 (yawning + blink triggers)
  detectionStatus: 'normal' | 'fatigued' | 'distracted' | 'asleep' | 'emergency';
}

export interface CabinSettings {
  ambientColor: string; // hex or Tailwind color
  ambientIntensity: number; // 0 - 100
  musicPlaylist: string;
  volumeReduction: boolean;
  climateComfortAdjustment: boolean;
}

export interface SensorStatus {
  blindSpotSensitivity: 'low' | 'medium' | 'high' | 'ultra';
  collisionWarningDistance: 'standard' | 'early' | 'very-early';
  laneAssistStrength: 'off' | 'low' | 'moderate' | 'maximum';
  safetyOverrideArmed: boolean;
}

export interface CruiseRecommendation {
  status: 'recommended' | 'active' | 'not-needed' | 'forced';
  reason: string;
}

export interface AuraResponse {
  primaryMessage: string;
  actionTaken: string;
  isVoiceSpoken: boolean;
  alertLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export interface EnvironmentData {
  trafficDensity: 'low' | 'medium' | 'heavy' | 'stop-and-go';
  weather: 'clear' | 'overcast' | 'rainy' | 'stormy';
  roadType: 'freeway' | 'highway' | 'suburban' | 'narrow-street';
  ambientLightingLevel: number; // 0 - 100 (%)
}

export interface VehicleTelemetry {
  speed: number; // km/h
  steeringConsistency: number; // 0 - 100 (%)
  brakePedalResponse: number; // ms
  acceleratorPosition: number; // %
}

export interface ActiveState {
  biometrics: BiometricData;
  cabin: CabinSettings;
  sensors: SensorStatus;
  cruise: CruiseRecommendation;
  env: EnvironmentData;
  telemetry: VehicleTelemetry;
  aura: AuraResponse;
}

export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  data: ActiveState;
}

export interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT';
  path: string;
  description: string;
  requestBody?: string;
  responseBody: string;
}
