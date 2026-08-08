import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { City } from "../models/city.model.js";

const addCity = asyncHandler(async (req, res) => {

    const { name } = req.body;

    // Validation
    if (!name?.trim()) {
        throw new ApiError(400, "City name is required");
    }

    // Check duplicate
    const existingCity = await City.findOne({
        name: name.toLowerCase().trim()
    });

    if (existingCity) {
        throw new ApiError(409, "City already exists");
    }

    // Create City
    const city = await City.create({
        name
    });

    const response = new ApiResponse(
        201,
        city,
        "City added successfully"
    );

    console.log("========== Add City ==========");
    console.dir(response, { depth: null });

    return res.status(201).json(response);

});

const getCities = asyncHandler(async (req, res) => {

    const cities = await City.find().sort({ name: 1 });

    const response = new ApiResponse(
        200,
        cities,
        "Cities fetched successfully"
    );

    console.log("========== Get Cities ==========");
    console.dir(response, { depth: null });

    return res.status(200).json(response);

});

export { addCity, getCities };