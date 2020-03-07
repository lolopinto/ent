var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import User, { createUser, editUser, deleteUser } from "../../src/ent/user";
import DB from "../../../../src/db";
import { v4 as uuidv4 } from 'uuid';
// TODO we need something that does this by default for all tests
afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
    yield DB.getInstance().endPool();
}));
function create(input) {
    return __awaiter(this, void 0, void 0, function* () {
        let user = yield createUser(input);
        if (user == null) {
            fail("could not create user");
        }
        return user;
    });
}
;
test('create user', () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let user = yield create({ firstName: "Jon", lastName: "Snow" });
        expect(user.firstName).toBe("Jon");
        expect(user.lastName).toBe("Snow");
    }
    catch (e) {
        fail(e.message);
    }
}));
test('edit user', () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let user = yield create({ firstName: "Jon", lastName: "Snow" });
        let editedUser = yield editUser(user.id, { firstName: "First of his name" });
        expect(editedUser).not.toBe(null);
        expect(editedUser === null || editedUser === void 0 ? void 0 : editedUser.firstName).toBe("First of his name");
        expect(editedUser === null || editedUser === void 0 ? void 0 : editedUser.lastName).toBe("Snow");
    }
    catch (e) {
        fail(e.message);
    }
}));
test('delete user', () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let user = yield create({ firstName: "Jon", lastName: "Snow" });
        yield deleteUser(user.id);
        let loadedUser = yield User.load(user.id);
        expect(loadedUser).toBe(null);
    }
    catch (e) {
        fail(e.message);
    }
}));
test('loadX', () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield User.loadX(uuidv4());
        fail("should have thrown exception");
    }
    catch (e) {
    }
}));
