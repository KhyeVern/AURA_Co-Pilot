/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScenarioPreset } from './types';

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'normal',
    name: 'Normal Commute',
    description: 'Driver is alert, relaxed, and traffic conditions are clear.',
    data: {
      biometrics: {
        heartRate: 72,
        heartRateVariability: 55,
        stressScore: 25,
        sleepinessScore: 10,
        detectionStatus: 'normal'
      },
      cabin: {
        ambientColor: '#06b6d4', // cyan-500
        ambientIntensity: 30,
        musicPlaylist: 'Blue Horizon Jazz FM',
        volumeReduction: false,
        climateComfortAdjustment: false
      },
      sensors: {
        blindSpotSensitivity: 'medium',
        collisionWarningDistance: 'standard',
        laneAssistStrength: 'moderate',
        safetyOverrideArmed: false
      },
      cruise: {
        status: 'not-needed',
        reason: 'Optimal alignment of driver biometrics and highway conditions.'
      },
      env: {
        trafficDensity: 'low',
        weather: 'clear',
        roadType: 'freeway',
        ambientLightingLevel: 80
      },
      telemetry: {
        speed: 90,
        steeringConsistency: 96,
        brakePedalResponse: 310,
        acceleratorPosition: 45
      },
      aura: {
        primaryMessage: "All systems nominal. Road flow looks regular. Ambient background level adjusted for evening light.",
        actionTaken: "No intervention needed. Sensor calibrations at standard presets.",
        isVoiceSpoken: false,
        alertLevel: 'none'
      }
    }
  },
  {
    id: 'stressed',
    name: 'Heavy Rain & Traffic Jam',
    description: 'Stop-and-go peak traffic, rainy conditions. Smart watch records elevated heart rate and stress indicators.',
    data: {
      biometrics: {
        heartRate: 104,
        heartRateVariability: 24,
        stressScore: 84,
        sleepinessScore: 15,
        detectionStatus: 'normal'
      },
      cabin: {
        ambientColor: '#10b981', // emerald-500 calms nerves
        ambientIntensity: 75,
        musicPlaylist: 'Rainforest Echoes (Calm Lofi Chillout)',
        volumeReduction: true,
        climateComfortAdjustment: true
      },
      sensors: {
        blindSpotSensitivity: 'high',
        collisionWarningDistance: 'early',
        laneAssistStrength: 'moderate',
        safetyOverrideArmed: true
      },
      cruise: {
        status: 'recommended',
        reason: 'Repeated high-frequency braking detected on wet surface. Recommending Adaptive Cruise with Stop-&-Go.'
      },
      env: {
        trafficDensity: 'stop-and-go',
        weather: 'rainy',
        roadType: 'suburban',
        ambientLightingLevel: 30
      },
      telemetry: {
        speed: 28,
        steeringConsistency: 85,
        brakePedalResponse: 380,
        acceleratorPosition: 15
      },
      aura: {
        primaryMessage: "I notice heavy traffic ahead and your heartbeat suggests moderate stress on this wet stretch. Would you like me to engage Adaptive Cruise with Stop-&-Go and ease your throttle response?",
        actionTaken: "Blipped blind-spot sensors to high-alert, softened throttle response, and dimmed notification sounds.",
        isVoiceSpoken: true,
        alertLevel: 'low'
      }
    }
  },
  {
    id: 'fatigued',
    name: 'Monotonous Highway Fatigue',
    description: 'Driver exhibits sleepy eyelids, yawning, drifting lanes, and delayed brake response times.',
    data: {
      biometrics: {
        heartRate: 54,
        heartRateVariability: 78,
        stressScore: 12,
        sleepinessScore: 88,
        detectionStatus: 'fatigued'
      },
      cabin: {
        ambientColor: '#f59e0b', // amber-500 wake color
        ambientIntensity: 95,
        musicPlaylist: 'High-Tempo Neuro-Synth (Revitalizing)',
        volumeReduction: false,
        climateComfortAdjustment: true
      },
      sensors: {
        blindSpotSensitivity: 'ultra',
        collisionWarningDistance: 'very-early',
        laneAssistStrength: 'maximum',
        safetyOverrideArmed: true
      },
      cruise: {
        status: 'active',
        reason: 'Active fatigue override, aligning steering offset and steering correction triggers to safe highway buffer.'
      },
      env: {
        trafficDensity: 'medium',
        weather: 'overcast',
        roadType: 'freeway',
        ambientLightingLevel: 15
      },
      telemetry: {
        speed: 105,
        steeringConsistency: 54,
        brakePedalResponse: 590,
        acceleratorPosition: 60
      },
      aura: {
        primaryMessage: "Yawning and drifting detected. Activating active lane-centering override. Shall I guide you to the rest stop 2 miles ahead at exit 42?",
        actionTaken: "Forced active lane centering, dialed radar collision distance to max, trigger active fatigue visualizer.",
        isVoiceSpoken: true,
        alertLevel: 'high'
      }
    }
  },
  {
    id: 'sporty',
    name: 'Open Scenic Bypass',
    description: 'Open winding road, clear line of sight, driver steering behavior shows positive engagement.',
    data: {
      biometrics: {
        heartRate: 80,
        heartRateVariability: 62,
        stressScore: 18,
        sleepinessScore: 5,
        detectionStatus: 'normal'
      },
      cabin: {
        ambientColor: '#6366f1', // indigo-500
        ambientIntensity: 40,
        musicPlaylist: 'Midnight Asphalt (Synthwave Driving)',
        volumeReduction: false,
        climateComfortAdjustment: false
      },
      sensors: {
        blindSpotSensitivity: 'medium',
        collisionWarningDistance: 'standard',
        laneAssistStrength: 'low',
        safetyOverrideArmed: false
      },
      cruise: {
        status: 'not-needed',
        reason: 'Active driver throttle interest with empty roads ahead. Adaptive dynamics calibrated to SPORT and loose torque vectoring.'
      },
      env: {
        trafficDensity: 'low',
        weather: 'clear',
        roadType: 'highway',
        ambientLightingLevel: 90
      },
      telemetry: {
        speed: 115,
        steeringConsistency: 99,
        brakePedalResponse: 240,
        acceleratorPosition: 75
      },
      aura: {
        primaryMessage: "Open highway and responsive driving patterns observed. Suggesting SPORT acceleration calibration with reduced lane feedback.",
        actionTaken: "Firmed chassis dampening controls, reduced steering intervention, and tuned torque sensitivity.",
        isVoiceSpoken: false,
        alertLevel: 'none'
      }
    }
  },
  {
    id: 'emergency',
    name: 'Cardiac / Unresponsive Emergency',
    description: 'Driver smart watch triggers acute cardiac tachycardia alarm, camera detects eye closure > 4 seconds.',
    data: {
      biometrics: {
        heartRate: 148,
        heartRateVariability: 8,
        stressScore: 98,
        sleepinessScore: 99,
        detectionStatus: 'emergency'
      },
      cabin: {
        ambientColor: '#ef4444', // red-500
        ambientIntensity: 100,
        musicPlaylist: 'EMERGENCY VOICE ALERTS + FLASHING CRITICAL INDICATOR',
        volumeReduction: true,
        climateComfortAdjustment: true
      },
      sensors: {
        blindSpotSensitivity: 'ultra',
        collisionWarningDistance: 'very-early',
        laneAssistStrength: 'maximum',
        safetyOverrideArmed: true
      },
      cruise: {
        status: 'forced',
        reason: 'DRIVER UNRESPONSIVE. Emergency Autonomous Safe-Shoulder Deceleration engaged.'
      },
      env: {
        trafficDensity: 'medium',
        weather: 'clear',
        roadType: 'highway',
        ambientLightingLevel: 45
      },
      telemetry: {
        speed: 12,
        steeringConsistency: 5,
        brakePedalResponse: 2000,
        acceleratorPosition: 0
      },
      aura: {
        primaryMessage: "CRITICAL: Abnormal physiological stress and lack of steering feedback. Slowly bringing the car to a safe stop, activating hazard signals, and transmitting GPS vitals to EMS dispatch.",
        actionTaken: "Forced Autonomous braking, emergency hazards on, pinging contact list for immediate help.",
        isVoiceSpoken: true,
        alertLevel: 'critical'
      }
    }
  }
];

export const MOCK_API_DOCUMENTATION = [
  {
    id: 'telemetry-post',
    method: 'POST' as const,
    path: '/api/v1/vehicle/telemetry',
    description: 'Ingests real-time vehicle driver tracking variables. Combines smartwatch biometrics (heart rate, HRV) with in-cabin vision logs (blink rate, drowsiness rate) and vehicle metrics.',
    requestBody: JSON.stringify({
      biometrics: {
        smartwatch_heart_rate: 84,
        hr_variability_ms: 32,
        cabin_drowiness_index: 12,
        camera_focus_score: 95
      },
      vehicle: {
        steering_consistency_percent: 88,
        speed_kmh: 90,
        pedal_response_lat_ms: 280
      },
      environment: {
        traffic_density: "stop-and-go",
        slick_surface: true
      }
    }, null, 2),
    responseBody: JSON.stringify({
      status: "success",
      driver_condition: "stressed",
      aura_engine: {
        decisions: {
          suggestion_alert_engaged: true,
          comfort_drive_mode_override: true,
          safety_blindspot_level: "high",
          response_voice_prompt: "Heavy stop-and-go detected, your HRV shows stress indicators. Suggested comfort adaptive cruise."
        },
        cabin_sync: {
          ambient_lighting: "#10b981",
          ac_chassis_target: "chill",
          music_vol_dimmed: true
        }
      }
    }, null, 2)
  },
  {
    id: 'aura-actions-get',
    method: 'GET' as const,
    path: '/api/v1/aura/status',
    description: 'Returns the currently computed status of the AURA engine active controls, describing active interventions, recommendations, and physiological assessment values.',
    responseBody: JSON.stringify({
      active_driver_profile: {
        fatigue_state: "moderate",
        vital_stress_state: "elevated",
        attention_status: "distracted"
      },
      active_sensor_calibrations: {
        radar_alert_timing: "very-early",
        lane_assist_rigidity: "high",
        blindspot_monitoring_gain: "ultra"
      },
      cabin_active_adjustments: {
        sound_volume_reduction: true,
        ambient_color_overlay: "#f59e0b",
        playlist_genre: "Upbeat Techno",
        fan_speed_burst: true
      }
    }, null, 2)
  },
  {
    id: 'emergency-call',
    method: 'POST' as const,
    path: '/api/v1/aura/emergency-intervene',
    description: 'Triggers active emergency roadside stop procedures. Triggered autonomously if heartbeat anomalies and camera feedback indicate unconscious state with no driver brake feedback.',
    requestBody: JSON.stringify({
      coordinate_latitude: 37.774929,
      coordinate_longitude: -122.419416,
      physiological_trigger: "hr_tachycardia_148_unresponsive",
      active_speed_kmh: 42
    }, null, 2),
    responseBody: JSON.stringify({
      emergency_procedure_status: "active",
      autonomous_lane_pull_initiated: true,
      hazards_activated: true,
      dispatch_message_transmitted: "Dispatch target: 37.774929, -122.419416. Smartwatch alert: HR 148, unconscious driver.",
      contact_notified: ["+1 (555) 019-9022", "emergency-medical-services"]
    }, null, 2)
  }
];
