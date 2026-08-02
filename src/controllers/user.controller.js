import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import { uploadImagesToCloudinary } from "../utils/upload.js";


const registerUser = asyncHandler(async (req, res) => {

     // get the user data form the user
    const { username, email, fullName, password } = req.body;

     // validation on the user data - not empty 
    if (!username || !email || !fullName || !password) {
        throw new ApiError(400, "All fields are required");
    }

    // check if the user already exists in the database using username or email
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });

    if (existingUser) {
        throw new ApiError(409, "User with email or username already exists");
    }

    // check for the images, check for avatar
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar image are required");
    }

    // upload them on the cloudinary
    const avatar = await uploadImagesToCloudinary(avatarLocalPath);
    let coverImage = null;

    if (coverImageLocalPath) {
        coverImage = await uploadImagesToCloudinary(coverImageLocalPath);
    }

    if(!avatar){
        throw new ApiError(400, "Avatar image is required");
    }

    // create user object - create entry in db 
    const user = await User.create({
        fullName, 
        username: username.toLowerCase(), 
        email, 
        password, 
        avatar: avatar.url, 
        coverImage: coverImage?.url || ""
    });

    // remove the password and refresh token from the response
    const createdUser = await User.findById(user._id).select("-password -refreshToken");
    console.log("========== Response ==========");
    console.log(JSON.stringify(createdUser, null, 2));

    // check for user creation 
    if(!createdUser) {
        throw new ApiError(500, "User not created");
    }

    // return res 
    return res.status(201).json(
        new ApiResponse(
            201, 
            createdUser, 
            "User created successfully"
        )
    );

});

export {registerUser};
