export type RequestAdmissionResult =
  | {
      readonly admitted: true;
      readonly requestCount: number;
      readonly remainingRequests: number;
    }
  | {
      readonly admitted: false;
      readonly remainingRequests: 0;
      readonly reason: "monthly request quota exceeded";
    };
