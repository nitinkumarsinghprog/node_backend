import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import { uploadImagesToCloudinary } from "../utils/upload.js";
import jwt from "jsonwebtoken";

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

const registerUser = asyncHandler (async (req, res) => {

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

const loginUser = asyncHandler (async (req, res) => {
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

const logoutUser = asyncHandler (async (req, res) => {
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

const refresAccessToken = asyncHandler (async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if(!incomingRefreshToken) {
        throw new ApiError(401, "Refresh token is missing");
    }

    try{
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

        const user = await User.findById(decodedToken?._id);

        if(!user){
            throw new ApiError(401, "Invalid Refresh Token");
        }

        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is not valid");
        }

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        };

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshToken(user._id);

         const response = new ApiResponse(
                    200,
                    {
                        accessToken: accessToken,
                        refreshToken: newRefreshToken
                    },
                    "Access token refreshed successfully"
                )

        console.log("========== Refresh Access Token Response ==========");
        console.dir(response, { depth: null });

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json( response ); 
    }catch (error) {
        throw new ApiError(401, "Invalid Refresh Token");
    } 
});

const changeCurrentPassword = asyncHandler (async (req, res) => {

    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect) {
        throw new ApiError(401, "Old password is incorrect");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    const response = new ApiResponse(
        200, {}, "Password changed successfully"
    )

    console.log("========== Change Password Response ==========");
    console.dir(response, { depth: null });

    return res.status(200).json(response);
    
});

const getCurrentUser = asyncHandler (async (req, res) => {

    const response =  new ApiResponse(200, req.user, "Current user fetched successfully")

    console.log("========== Get Current User Response ==========");
    console.dir(response, { depth: null });

    return res.status(200).json(response);
});

const updateAccountDetails = asyncHandler (async (req, res) => {
    const {fullName, email} = req.body;

    if(!fullName || !email){
        throw ApiError (400, "Full Name and Email are required");
    }

    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set : {
            fullName,
            email: email.toLowerCase()
        }
    }, 
    {new: true}
    ).select("_password");

    const response =  new ApiResponse(200, user, "Account Details Updated Successfully");

    console.log("========== Update Account Details Response ==========");
    console.dir(response, { depth: null });

    return res.status(200).json(response);
});

const updateUserAvatar = asyncHandler (async (req, res)=> {
    const avtartLocalPath =  req.file?.path;

    if(!avtartLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    };

    const avatar = await uploadImagesToCloudinary(avtartLocalPath);

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading avatar");
    }

    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set: {
            avatar: avatar.url
        }
    }, {new : true}).select("-password");

    const response =   new ApiResponse(200, user, "Avatar Updated Successfully");

    console.log("========== Update Avatar Response ==========");
    console.dir(response, { depth: null });

    return res.status(200).json(response);
});

const updateCoverImage = asyncHandler (async (req, res)=> {
    const coverImagePath =  req.file?.path;

    if(!coverImagePath){
        throw new ApiError(400, "Cover image file is missing")
    };

    const coverImage = await uploadImagesToCloudinary(coverImagePath);

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading cover image");
    }

    const user = await User.findByIdAndUpdate(req.user?._id, {
        $set: {
            coverImage: coverImage.url
        }
    }, {new : true}).select("-password");

    const response =   new ApiResponse(200, user, "Cover Image Updated Successfully");

    console.log("========== Update Cover Image Response ==========");
    console.dir(response, { depth: null });

    return res.status(200).json(response);
});

const getUserChannelProfile = asyncHandler (async (req, res) => {
    const {username} = req.params;

    if (!username?.trim()) {
        throw new ApiError(400, "Username is missing");
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
            
        },
        {
                
            $lookup: {
                from : "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup : {
                from : "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: { $size: "$subscribers" },
                subscribedToCount: { $size: "$subscribedTo" },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                subscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ]);

    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exit");
    }

    const response =   new ApiResponse(200, channel[0], "User channel fecth Successfully");

    console.log("========== Update Cover Image Response ==========");
    console.dir(response, { depth: null });

    return res.status(200).json( response );
});

export {
    registerUser, 
    loginUser, 
    logoutUser, 
    refresAccessToken, 
    changeCurrentPassword, 
    getCurrentUser, 
    updateAccountDetails,
    updateCoverImage,
    updateUserAvatar, 
    getUserChannelProfile
};

