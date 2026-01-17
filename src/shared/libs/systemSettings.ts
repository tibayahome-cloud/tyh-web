import api from "./api";

export type BroadcastRadiusSetting = {
  key: string;
  value: number;
  default: number;
};

export const fetchBroadcastRadiusSetting = async (): Promise<BroadcastRadiusSetting> => {
  const response = await api.get("/system-settings/broadcast-radius");
  return response.data?.data as BroadcastRadiusSetting;
};

export const updateBroadcastRadiusSetting = async (value: number): Promise<BroadcastRadiusSetting> => {
  const response = await api.put("/system-settings/broadcast-radius", { value });
  return response.data?.data as BroadcastRadiusSetting;
};
