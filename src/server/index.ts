import { defineRoom, defineServer } from "colyseus";
import { healthResponse } from "./health";
import { ClassroomRoom } from "./rooms/ClassroomRoom";

export const server = defineServer({
  auth: false,
  rooms: { classroom: defineRoom(ClassroomRoom) },
  express: (app) => { app.get("/health", (_request, response) => { response.json(healthResponse()); }); },
});
