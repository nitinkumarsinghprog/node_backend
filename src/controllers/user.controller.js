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
        throw new ApiError("All fields are required", 400);
    }

    // check if the user already exists in the database using username or email
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });

    if (existingUser) {
        throw new ApiError("User with email or username already exists", 409);
    }

    // check for the images, check for avatar
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if(!avatarLocalPath) {
        throw new ApiError("Avatar image are required", 400);
    }

    // upload them on the cloudinary
    const avatar = await uploadImagesToCloudinary(avatarLocalPath);
    let coverImage = null;

    if (coverImageLocalPath) {
        coverImage = await uploadImagesToCloudinary(coverImageLocalPath);
    }

    if(!avatar){
        throw new ApiError("Avatar image is required", 400);
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
        throw new ApiError("User not created", 500);
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
