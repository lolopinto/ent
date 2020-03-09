var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createUser } from "../../src/ent/user";
import Event, { createEvent, editEvent, deleteEvent } from "../../src/ent/event";
import DB from "../../../../src/db";
// TODO we need something that does this by default for all tests
afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
    yield DB.getInstance().endPool();
}));
function create(startTime) {
    return __awaiter(this, void 0, void 0, function* () {
        let user = yield createUser({ firstName: "Jon", lastName: "Snow" });
        if (!user) {
            fail("could not create user");
        }
        let event = yield createEvent({ name: "fun event",
            creatorID: user.id,
            startTime: startTime,
            location: "location",
        });
        if (event == null) {
            fail("could not create event");
        }
        return event;
    });
}
;
test('create event', () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let date = new Date();
        let event = yield create(date);
        expect(event.name).toBe("fun event");
        expect(event.location).toBe("location");
        // Todo handle this better either via mock or something else 
        expect(event.startTime.toDateString()).toBe(date.toDateString());
        expect(event.creatorID).not.toBe(null);
        expect(event.endTime).toBe(null);
    }
    catch (e) {
        fail(e.message);
    }
}));
test('edit event', () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let date = new Date();
        let event = yield create(date);
        let editedEvent = yield editEvent(event.id, { location: "fun location" });
        expect(editedEvent).not.toBe(null);
        expect(editedEvent === null || editedEvent === void 0 ? void 0 : editedEvent.name).toBe("fun event");
        expect(editedEvent === null || editedEvent === void 0 ? void 0 : editedEvent.location).toBe("fun location");
        expect(editedEvent === null || editedEvent === void 0 ? void 0 : editedEvent.startTime.toDateString()).toBe(date.toDateString());
        expect(editedEvent === null || editedEvent === void 0 ? void 0 : editedEvent.creatorID).not.toBe(null);
        expect(event.endTime).toBe(null);
    }
    catch (e) {
        fail(e.message);
    }
}));
test('edit nullable field', () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        let date = new Date();
        let event = yield create(date);
        let endTime = new Date(date.getTime());
        endTime.setTime(date.getTime() + 24 * 60 * 60);
        let editedEvent = yield editEvent(event.id, { endTime: endTime });
        expect(editedEvent).not.toBe(null);
        expect(editedEvent === null || editedEvent === void 0 ? void 0 : editedEvent.name).toBe("fun event");
        expect(editedEvent === null || editedEvent === void 0 ? void 0 : editedEvent.location).toBe("location");
        expect(editedEvent === null || editedEvent === void 0 ? void 0 : editedEvent.startTime.toDateString()).toBe(date.toDateString());
        expect(editedEvent === null || editedEvent === void 0 ? void 0 : editedEvent.creatorID).not.toBe(null);
        expect((_a = editedEvent === null || editedEvent === void 0 ? void 0 : editedEvent.endTime) === null || _a === void 0 ? void 0 : _a.toDateString()).toBe(endTime.toDateString());
        // re-edit and clear the value
        editedEvent = yield editEvent(event.id, { endTime: null });
        expect(editedEvent).not.toBe(null);
        expect(editedEvent === null || editedEvent === void 0 ? void 0 : editedEvent.name).toBe("fun event");
        expect(editedEvent === null || editedEvent === void 0 ? void 0 : editedEvent.location).toBe("location");
        expect(editedEvent === null || editedEvent === void 0 ? void 0 : editedEvent.startTime.toDateString()).toBe(date.toDateString());
        expect(editedEvent === null || editedEvent === void 0 ? void 0 : editedEvent.creatorID).not.toBe(null);
        expect(editedEvent === null || editedEvent === void 0 ? void 0 : editedEvent.endTime).toBe(null);
    }
    catch (e) {
        fail(e.message);
    }
}));
test('delete event', () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let event = yield create(new Date());
        yield deleteEvent(event.id);
        let loadEvent = yield Event.load(event.id);
        expect(loadEvent).toBe(null);
    }
    catch (e) {
        fail(e.message);
    }
}));
