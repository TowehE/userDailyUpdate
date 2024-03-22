const userModel = require("../model/userModel");
const {userDataModel} = require("../model/dataModel");
const { validateUser, validateUserLogin, validateLocation, } = require("../validator/validator");
const bcrypt = require("bcrypt");
const {sendEmail} = require("../emailFile/email");
const cloudinary = require("../middleware/cloudinary");
const jwt = require('jsonwebtoken');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const { generateDynamicEmail } = require("../emailFile/emailText");

//function to capitalize the first letter
const capitalizeFirstLetter = (str) => {
    return str[0].toUpperCase() + str.slice(1);
};


exports.signUp = async (req, res) => {
    try {
        const { error } = validateUser(req.body);
        if (error) {
            return res.status(500).json({
                message: error.details[0].message
            });
        } else {
            const { firstName, lastName, email, password } = req.body;

            // check if email already exists
            const emailExists = await userModel.findOne({ email: email.toLowerCase() });
            if (emailExists) {
                return res.status(200).json({
                    message: 'Email already exists',
                });
            }

            // hash password
            const salt = bcrypt.genSaltSync(12);
            const hashedpassword = bcrypt.hashSync(password, salt);

            // create new user instance
            const newUser = new userModel({
                firstName: capitalizeFirstLetter(firstName).trim(),
                lastName: capitalizeFirstLetter(lastName).trim(),
                email: email.toLowerCase(),
                password: hashedpassword,
            });

            // check if user exists already
            if (!newUser) {
                return res.status(404).json({
                    message: 'User not found',
                });
            }

            // get user fullname
            const first = newUser.firstName.slice(0, 1).toUpperCase();
            const firstN = newUser.firstName.slice(1).toLowerCase();
            const surn = newUser.lastName.slice(0, 1).toUpperCase();
            const fullName = first + firstN + " " + surn;

            // create JWT token
            const token = jwt.sign({
                firstName: newUser.firstName,
                lastName: newUser.lastName,
                email: newUser.email,
            }, process.env.secret, { expiresIn: "600s" });

            // assign token to user
            newUser.token = token;

            // generate email verification link
            const subject = 'Email Verification';
            const link = `${req.protocol}://${req.get('host')}/api/v1/verify/${newUser.id}`;
            const html = generateDynamicEmail(fullName, link);

            // send verification email
            sendEmail({
                email: newUser.email,
                html,
                subject
            });

            // save user to database
            await newUser.save();

            return res.status(200).json({
                message: 'User created successfully',
                data: newUser,
            });
        }
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error: " + error.message,
        });
    }
};



//Function to verify a new user with a link
exports.verify = async (req, res) => {
    try {
        const id = req.params.id;
     
        // find user by Id
        const user = await userModel.findById(id);
        if(!user){
            return res.status(404).json({
                message: "user not found",
            })
        }
    

        // Verify the token
        jwt.verify(token, process.env.secret);

        // Update the user if verification is successful
        const updatedUser = await userModel.findByIdAndUpdate(id, { isVerified: true }, { new: true });

        if (updatedUser.isVerified === true) {
        res.status(200).send(`
        <div style="text-align: center; padding: 50px; background-color: #f0f8f0;">
            <h3 style="color: #008000;">You have been successfully verified.</h3>
            <p style="color: #008000;">Kindly visit the login page.</p>
            <p style="color: #008000;">You will be redirected in 5 seconds.</p>
            <script>
                setTimeout(() => { window.location.href = '/api/v1/login'; }, 5000);
            </script>
        </div>

    `);
    }

    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            // Handle token expiration
            const id = req.params.id;
            const updatedUser = await userModel.findById(id);
            if(!updatedUser){
                return res.status(404).json({
                    message: "user not found",
                })
            }

            const newtoken = jwt.sign({ 
                email: updatedUser.email, 
                firstName: updatedUser.firstName, 
                lastName: updatedUser.lastName }, process.env.secret, { expiresIn: "600s" });
            updatedUser.token = newtoken;
            updatedUser.save();

            const link = `${req.protocol}://${req.get('host')}/api/v1/verify/${id}`;
            sendEmail({
                email: updatedUser.email,
                html: generateDynamicEmail(updatedUser.firstName, link),
                subject: "RE-VERIFY YOUR ACCOUNT"
            });
            res.status(401).send("<h1>This link is expired. Kindly check your email for another email to verify.</h1>");
            return;
        } else {
            return res.status(500).json({
                message: "Internal server error: " + error.message,
            });
        }
    }
};


//Function to login a verified user
exports.logIn = async (req, res) => {
    try {
        const { error } = validateUserLogin(req.body);
        if (error) {
            return res.status(500).json({
                message: error.details[0].message
            })
        } else {
            const { email, password } = req.body;
            const checkEmail = await userModel.findOne({ email: email.toLowerCase() });
            if (!checkEmail) {
                return res.status(404).json({
                    message: 'Email not registered'
                });
            }
            const checkPassword = bcrypt.compareSync(password, checkEmail.password);
            if (!checkPassword) {
                return res.status(404).json({
                    message: "Password is not correct"
                })
            }
            const token = jwt.sign({
                userId: checkEmail._id,
            }, process.env.secret, { expiresIn: "12h" });

            checkEmail.token = token;
            await checkEmail.save();

            if (checkEmail.isVerified === true) {
                return res.status(200).json({
                    message: "Login Successfully. Welcome " + checkEmail.firstName + " " + checkEmail.lastName,
                    token: token
                })
            } else {
                return res.status(400).json({
                    message: "Sorry user not verified yet."
                })
            }
        }

    } catch (error) {
        return res.status(500).json({
            message: "Internal server error: " + error.message,
        });
    }
};


//Function for the user incase password is forgotten
exports.forgotPassword = async (req, res) => {
    try {
        const checkUser = await userModel.findOne({ email: req.body.email });
        if (!checkUser) {
            return res.status(404).json({
                message: 'Email does not exist'
            });
        }
        else {
            const subject = 'Kindly reset your password'
            const link = `${req.protocol}://${req.get('host')}/api/v1/reset/${checkUser.id}`
            const html = resetFunction(checkUser.firstName, link)
            sendEmail({
                email: checkUser.email,
                html,
                subject
            })
            return res.status(200).json({
                message: "Kindly check your email to reset your password",
            })
        }
    } catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error: ' + error.message,
        })
    }
};






//Function to signOut a user
exports.signOut = async (req, res) => {
    try {
        const userId = req.user.userId
        const newUser = await userModel.findById(userId)
        if (!newUser) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        newUser.token = null;
        await newUser.save();
        return res.status(201).json({
            message: `user has been signed out successfully`
        })
    }
    catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error: ' + error.message,
        })
    }
}




// Handling the location & profilePicture data
exports.location = async (req, res) => {
    try {
        const { error } = validateLocation(req.body);
        if (error) {
            return res.status(400).json({
                message: error.details[0].message
            });
        }

        // Find user details
        const userId = req.user.userId;
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const location = req.body.location.toLowerCase();
        if (!location) {
            return res.status(400).json({
                message: "Please provide your location"
            });
        }

        // Check if the user has already entered data for today
        const today = moment();
        const currentTime = today.format('HH:mm:ss');
        const currentDate = today.format('YYYY-MM-DD');
      

        let userDailyUpload = await userDataModel.findOne({ userId, date: currentDate });
        if (userDailyUpload) {
            return res.status(400).json({
                errorMessage: "User has already submitted data for today"
            });
        }



 // Save new user data
 const newUserDailyUpload = new userDataModel({
    userId: userId,
    location: capitalizeFirstLetter(location),
    time: currentTime,
    date: currentDate,
});
    
        // Save newUserDailyUpload to the database
        await newUserDailyUpload.save();

        // If the user has uploaded a profilePicture, upload and save it
        if (req.files && req.files.profilePicture) {
            const profilePicture = req.files.profilePicture;

            // Check if only one file is uploaded
            if (profilePicture.length > 1) {
                return res.status(400).json({
                    message: "Please upload only one profilePicture file"
                });
            }

            const fileExtension = path.extname(profilePicture.name).toLowerCase();
            const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];

            if (!allowedExtensions.includes(fileExtension)) {
                return res.status(400).json({
                    message: "Only profilePicture is allowed"
                });
            }

            const fileUploader = await cloudinary.uploader.upload(profilePicture.tempFilePath, { folder: "Data-profilePicture" });

            // Delete the temporary file
            fs.unlinkSync(profilePicture.tempFilePath);

            // Update newUserDailyUpload with profilePicture information
            newUserDailyUpload.profilePicture = {
                public_id: fileUploader.public_id,
                url: fileUploader.secure_url
            };
        }

        // Save newUserDailyUpload to the database again if profilePicture was uploaded
        await newUserDailyUpload.save();

        // Push newUserDailyUpload into user.data array
        if (!user.data) {
            user.data = []; 
        }
        user.data.push(newUserDailyUpload);
        await user.save();

        return res.status(200).json({
            message: 'User data created successfully',
            data: newUserDailyUpload
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error: ' + error.message
        });
    }
};






































