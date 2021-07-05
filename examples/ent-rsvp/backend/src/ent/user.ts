import { Data } from "@snowtop/ent";
import { UserBase } from "src/ent/internal";
import * as bcrypt from "bcryptjs";

// we're only writing this once except with --force and packageName provided
export class User extends UserBase {
  static async validateEmailPassword(
    email: string,
    password: string,
  ): Promise<Data | null> {
    const data = await User.loadRawDataFromEmailAddress(email);
    if (!data) {
      return null;
    }
    let valid = await bcrypt.compare(password, data.password || "");
    return valid ? data : null;
  }
}
