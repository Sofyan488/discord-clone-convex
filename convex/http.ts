import { httpRouter } from "convex/server";
import { auth } from "./auth";

// Registers the Convex Auth HTTP routes (sign-in/up/out callbacks).
const http = httpRouter();
auth.addHttpRoutes(http);

export default http;
