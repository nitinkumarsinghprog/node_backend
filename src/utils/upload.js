import {v2 as cloudinary} from "cloudinary";
import fs from "fs";

// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});    

const uploadImagesToCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null

        //upload file on the cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })

        //file has been uploaded 
        // console.log("file has been upload", response.url );
        fs.unlinkSync(localFilePath);
        return response;

    } catch (error) {
        // remove the local tem save file 
        fs.unlinkSync(localFilePath);
        return null;
    }
}

export { uploadImagesToCloudinary };
