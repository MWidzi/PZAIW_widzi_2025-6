import { createSession, deleteSession } from "./../models/session.js";
import { createUser, validatePassword } from "./../models/user.js";

export function signup_get(req, res) {
    let form = {
        data: {},
        fields: signup_form_fields,
        errors: {},
        action: "/auth/signup",
        method: "POST",
    };
    res.render("auth_signup", { title: "Registration", form });
}

export async function signup_post(req, res) {
    let form = {
        data: getFormData(req, signup_form_fields),
        fields: signup_form_fields,
        action: "/auth/signup",
        method: "POST",
    };
    form.errors = validateForm(form.data, form.fields);

    if (Object.entries(form.errors).length == 0) {
        let user = await createUser(form.data["username"], form.data["password"]);
        if (user != null) {
            createSession(user.id, res);
            res.redirect("/");
            return;
        } else {
            form.errors["username"] = "Username already in use";
        }
    }

    res.render("auth_signup", { title: "Registration", form });
}

export function login_get(req, res) {
    let form = {
        data: {},
        fields: login_form_fields,
        errors: {},
        action: "/auth/login",
        method: "POST",
    };
    res.render("auth_login", { title: "Logging in", form });
}

export async function login_post(req, res) {
    let form = {
        data: getFormData(req, login_form_fields),
        fields: login_form_fields,
        action: "/auth/login",
        method: "POST",
    };
    form.errors = validateForm(form.data, form.fields);

    if (Object.entries(form.errors).length == 0) {
        let userId = await validatePassword(form.data["username"], form.data["password"]);
        if (userId != null) {
            createSession(userId, res);
            res.redirect("/");
            return;
        } else {
            form.errors["username"] = "Incorrect username or password";
        }
    }

    res.render("auth_login", { title: "Logging in", form });
}

export function logout(req, res) {
    if (res.locals.user != null) {
        deleteSession(res);
    }
    res.redirect("/");
}

export default {
    login_get,
    login_post,
    signup_get,
    signup_post,
    logout
};

const login_form_fields = [
    {
        name: "username",
        display_name: "Username",
        type: "text",
        min_length: 3,
        max_length: 25,
        required: true,
    },
    {
        name: "password",
        display_name: "Password",
        type: "password",
        min_length: 8,
        required: true,
    },
];

const signup_form_fields = [
    {
        name: "username",
        display_name: "Username",
        type: "text",
        min_length: 3,
        max_length: 25,
        required: true,
    },
    {
        name: "password",
        display_name: "Password",
        type: "password",
        min_length: 8,
        required: true,
    },
    {
        name: "password_confirm",
        display_name: "Repeat password",
        type: "password",
        min_length: 8,
        required: true,
        must_match: "password",
    },
];

function getFormData(req, fields) {
    const data = {};
    fields.forEach(field => {
        data[field.name] = req.body[field.name];
    });
    return data;
}

function validateForm(data, fields) {
    const errors = {};

    fields.forEach(field => {
        if (field.required && typeof data[field.name] !== "string") {
            errors[field.name] = "${field.display_name} is required";
            return;
        }

        if (field.min_length != null && data[field.name].length < field.min_length) {
            errors[field.name] = `${field.display_name} must contain at least ${field.min_length} characters`;
        }
        if (field.max_length != null && data[field.name].length > field.max_length) {
            errors[field.name] = `${field.display_name} must contain less than ${field.max_length} characters`;
        }
        if (field.must_match != null && data[field.name] != data[field.must_match]) {
            errors[field.name] = `${field.display_name} must match ${fields.find((f) => f.name === field.must_match).display_name}`;
        }
    });

    return errors;
}
