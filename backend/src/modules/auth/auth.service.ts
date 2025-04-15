import { ErrorCode } from "../../common/enums/error-code.enum";
import { VerificationEnum } from "../../common/enums/verification-code.enum";
import { LoginDto, RegisterDto } from "../../common/interface/auth.interface";
import { BadRequestException } from "../../common/utils/catch-errors";
import { fortyFiveMinutesFromNow } from "../../common/utils/date-time";
import { config } from "../../config/app.config";
import SessionModel from "../../database/models/session.model";
import UserModel from "../../database/models/user.model";
import VerificationCodeModel from "../../database/models/verification.model";
import jwt from "jsonwebtoken";
export class AuthService {
  public async register(registerData: RegisterDto) {
    const { name, email, password } = registerData;
    const existingUser = await UserModel.exists({ email });
    if (existingUser) {
      throw new BadRequestException(
        "Email already exists",
        ErrorCode.AUTH_EMAIL_ALREADY_EXISTS
      );
    }
    const newUser = await UserModel.create({
      name,
      email,
      password,
    });
    const userId = newUser._id;
    const verification = await VerificationCodeModel.create({
      userId,
      type: VerificationEnum.EMAIL_VERIFICATION,
      expiresAt: fortyFiveMinutesFromNow(),
    });

    //send mail

    return {
      user: newUser,
    };
  }
  public async login(loginData: LoginDto) {
    const { email, password, userAgent } = loginData;
    const user = await UserModel.findOne({
      email: email,
    });
    if (!user) {
      throw new BadRequestException(
        "Invalid email or password provided",
        ErrorCode.AUTH_USER_NOT_FOUND
      );
    }
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new BadRequestException(
        "Invalid email or password provided",
        ErrorCode.AUTH_USER_NOT_FOUND
      );
    }
    // Check if the user enable 2fa return user= null
    // if (user.userPreferences.enable2FA) {
    //   return {
    //     user: null,
    //     mfaRequired: true,
    //     accessToken: "",
    //     refreshToken: "",
    //   };
    // }
    const session = await SessionModel.create({
      userId: user._id,
      userAgent,
    });
    const accessToken = jwt.sign(
      {
        sessionId: session._id,
      },
      config.JWT.SECRET as string,
      {
        audience: ["user"],
        expiresIn: "15m",
      }
    );
    const refreshToken = jwt.sign(
      {
        sessionId: session._id,
      },
      config.JWT.SECRET as string,
      {
        audience: ["user"],
        expiresIn: "30d",
      }
    );
    console.log("🚀 ~ AuthService ~ login ~ refreshToken:", refreshToken);
    return {
      user,
      accessToken,
      refreshToken,
      mfaRequired: true,
    };
  }
}
