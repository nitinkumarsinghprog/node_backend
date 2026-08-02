import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import { uploadImagesToCloudinary } from "../utils/upload.js";

const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false});

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating tokens");
    }
}

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

const loginUser = asyncHandler(async (req, res) => {
    // req body -> data
    const { username, password, email } = req.body;

    if (!username && !email) {
        throw new ApiError(400, "Username or Email is required");
    }

     // find the user 
    const user = await User.findOne({ $or: [{ username }, { email }] });

    if(!user){
        throw new ApiError(404, "User not found");
    }

    // password match
    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials");
    }
    
    // generate access token and refresh token
     const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

    // send cookies
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    console.log("========== Response ==========");
    console.log(JSON.stringify(loggedInUser, null, 2));

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    };

    // return the response
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,
                accessToken,
                refreshToken
            },
            "User logged in successfully"
        )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            returnDocument: "after"
        }
    );

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    };

    const response = new ApiResponse(
        200,
        {},
        "User logged out successfully"
    );

    console.log("========== Logout Response ==========");
    console.dir(response, { depth: null });

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(response);
});

export {registerUser, loginUser, logoutUser};
