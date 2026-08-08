import { Router } from "express";
import { addCity, getCities } from "../controllers/city.controller.js";

const cityRouter = Router();
cityRouter.route("/add-city").post(addCity);
cityRouter.route("/city").get(getCities);

export default cityRouter;