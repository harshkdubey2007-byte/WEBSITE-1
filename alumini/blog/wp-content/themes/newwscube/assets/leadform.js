//eduction 
let education = document.querySelector('#cf-edu');

fetch("https://ws-api.wscubetech.com/webapi/services/get-educations", {
    method: "GET",
    headers: {
        "Authorization": "Basic d3NjdWJldGVjaDp3c2N1YmV0ZWNoQDEyMyEh",
        "Content-Type": "application/json"
    }
})
    .then(res => res.json())
    .then(data => {

        education.innerHTML = `<option value="">Select Highest Education</option>`;

        data.result.forEach(item => {
            let option = document.createElement("option");
            option.value = item.id;
            option.textContent = item.name;
            education.appendChild(option);
        });
    })
    .catch(err => {
        console.error("Fetch Error:", err);
    });

//Courses

let course = document.querySelector('#cf-course');

fetch("https://ws-api.wscubetech.com/webapi/services/get-courses-new", {
    method: "GET",
    headers: {
        "Authorization": "Basic d3NjdWJldGVjaDp3c2N1YmV0ZWNoQDEyMyEh",
        "Content-Type": "application/json"
    }
})
    .then(res => res.json())
    .then(data => {

        course.innerHTML = `<option value="">Select Course</option>`;

        data.result.forEach(item => {
            let option = document.createElement("option");
            option.value = item.id;
            option.textContent = item.name;
            course.appendChild(option);
        });
    })
    .catch(err => {
        console.error("Fetch Error:", err);
    });

//Country

let Country = document.querySelector('#cf-century');

fetch("https://ws-api.wscubetech.com/webapi/services/get-countries", {
    method: "GET",
    headers: {
        "Authorization": "Basic d3NjdWJldGVjaDp3c2N1YmV0ZWNoQDEyMyEh",
        "Content-Type": "application/json"
    }
})
    .then(res => res.json())
    .then(data => {

        Country.innerHTML = `<option value="">Select Century</option>`;

        data.result.forEach(item => {
            let option = document.createElement("option");
            option.value = item.id;
            option.textContent = item.name;
            Country.appendChild(option);
        });
    })
    .catch(err => {
        console.error("Fetch Error:", err);
    });


//lead-form

jQuery(document).ready(function ($) {

    const AUTH_HEADER = {
        "Authorization": "Basic d3NjdWJldGVjaDp3c2N1YmV0ZWNoQDEyMyEh",
        "Content-Type": "application/json"
    };

    let finalFormData = null;
    let otpToken = null;
    let crsId = null;
    let otpModalInstance = null;

    /* ==============================
       Phone Input Init
    ============================== */
    const input = document.querySelector("#cf-phone");
    const iti = window.intlTelInput(input, {
        separateDialCode: true,
        initialCountry: "in",
        preferredCountries: ["in", "us", "gb", "ca"],
        utilsScript:
            "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.13/js/utils.js"
    });

    function isLeadCourse(courseId) {
        return courseId === "47" || courseId === "8" || courseId === "9";
    }

    /* ==============================
       TOGGLE EMAIL & CENTURY BOX
    ============================== */
    function toggleEmailBox() {
        const countryCode = iti.getSelectedCountryData().dialCode;

        if (countryCode !== "91") {
            $("#email-box").removeClass("d-none");
        } else {
            $("#email-box").addClass("d-none");
            $("#cf-email").val("");
            $("#err-email").text("");
        }
    }

    function toggleCenturyBox(courseId) {
        if (courseId === "5" || courseId === "6") {
            $("#century-box").removeClass("d-none");
        } else {
            $("#century-box").addClass("d-none");
            $("#cf-century").val("");
            $("#err-century").text("");
        }
    }

	input.addEventListener("input", function () {

    const countryCode = iti.getSelectedCountryData().dialCode;

    // Sirf numbers allow
    let value = this.value.replace(/\D/g, "");

    // India (+91) ke liye sirf 10 digits
    if (countryCode === "91" && value.length > 10) {
        value = value.substring(0, 10);
    }

    this.value = value;
});

    input.addEventListener("countrychange", function () {
		this.value = "";
        toggleEmailBox();
    });

    $("#cf-course").on("change", function () {
        const courseId = $(this).val();
        toggleCenturyBox(courseId);
    });

	 function openOtpModal() {
		 console.log("Open Model")
		const el = document.getElementById("otpModal");
		if (!el) return;

		const careerModalEl = document.getElementById("careerModal");
		const careerModal = bootstrap.Modal.getInstance(careerModalEl);
		if (careerModal) careerModal.hide();

		if (window.finalFormData && finalFormData.mobile_number && finalFormData.country_code) {
			const mobileText = `+${finalFormData.country_code} ${finalFormData.mobile_number}`;
			const mobileEl = document.getElementById("otp-mobile");
			if (mobileEl) mobileEl.textContent = mobileText;
		}

		otpModalInstance = new bootstrap.Modal(el, {
			backdrop: "static",
			keyboard: false
		});
		otpModalInstance.show();
	}


    function closeOtpModal() {
        if (otpModalInstance) otpModalInstance.hide();
    }

    /* ==============================
       BUTTON HELPERS (ONLY ADDITION)
    ============================== */
    function disableContinueBtn() {
        $("#continueBtn").prop("disabled", true);
        $("#continueBtn .btn-text").addClass("d-none");
        $("#btnLoader").removeClass("d-none");
    }

    function enableContinueBtn() {
        $("#continueBtn").prop("disabled", false);
        $("#continueBtn .btn-text").removeClass("d-none");
        $("#btnLoader").addClass("d-none");
    }

    /* ==============================
       FORM SUBMIT
    ============================== */
    $("#careerCounsellingForm").on("submit", function (e) {
        e.preventDefault();

        disableContinueBtn(); // 🔒 disable button on submit
        $(".error-msg").text("");

        const name = $("#cf-name").val().trim();
        const education = $("#cf-edu").val();
        const course = $("#cf-course").val();
        const century = $("#cf-century").val();
        const countryCode = iti.getSelectedCountryData().dialCode;

        const mobile = iti
            .getNumber(window.intlTelInputUtils.numberFormat.NATIONAL)
            .replace(/\D/g, "")
            .replace(/^0+/, "");

        const email = $("#cf-email").val().trim();

        crsId = course;
        let hasError = false;

        if (!name) {
            $("#err-name").text("Please enter name");
            hasError = true;
        }

        if (countryCode === "91" && !iti.isValidNumber()) {
            $("#err-phone").text("Invalid mobile number");
            hasError = true;
        }

        if (countryCode !== "91" && !email) {
            $("#err-email").text("Email required");
            hasError = true;
        }

        if (!education) {
            $("#err-edu").text("Select education");
            hasError = true;
        }

        if (!course) {
            $("#err-course").text("Select course");
            hasError = true;
        }

        if ((course === "5" || course === "5") && !century) {
            $("#err-century").text("Please select country");
            hasError = true;
        }

        if (hasError) {
            enableContinueBtn();
            return;
        }

        finalFormData = {
            name: name,
            mobile_number: mobile,
            country_code: countryCode,
            email: email,
            education_id: education,
            course_id: course,
            century: century,
            course_type_request: "Online",
            lead_note: "Get Free Career Counselling - Blog",
            lead_mode: 1,
            lead_source_id: 16,
			page_type : "Blog",
			cta_title : "Blog - Bottom Bar"
        };

        const careerModal = bootstrap.Modal.getInstance(
            document.getElementById("careerFormModal")
        );
        if (careerModal) careerModal.hide();

        if (countryCode === "91") {
            sendLeadOtp();
        } else {
            submitLeadForm();
        }
    });

    function sendLeadOtp() {

        const apiUrl = isLeadCourse(crsId)
            ? "https://ws-api.wscubetech.com/webapi/services/lead-otp"
            : "https://ws-api.wscubetech.com/webapi/services/web/lead-store-web";

        fetch(apiUrl, {
            method: "POST",
            headers: AUTH_HEADER,
            body: JSON.stringify(finalFormData)
        })
        .then(res => res.json())
        .then(res => {
            if (res.status === 1) {
                if (res.result?.mobile_number_verified === true) {
                    submitLeadForm();
                } else if (res.result?.request_token) {
                    otpToken = res.result.request_token;
                }
            } else {
                reactToast(res.message || "OTP send failed");
                enableContinueBtn();
            }
        })
        .catch(() => {
            reactToast("Something went wrong");
            enableContinueBtn();
        });
    }

    $("#verifyOtpBtn").on("click", function () {

        let otp = "";
        $(".otp-box").each(function () {
            otp += $(this).val();
        });

        if (otp.length !== 6) {
            $("#otp-error").text("Enter 6 digit OTP");
            return;
        }

        if (!otpToken) {
            $("#otp-error").text("OTP token missing");
            return;
        }

        const verifyApi = isLeadCourse(crsId)
            ? "https://ws-api.wscubetech.com/webapi/services/web/verify-otp"
            : "https://ws-api.wscubetech.com/webapi/services/lead-mobile-verify";

        fetch(verifyApi, {
            method: "POST",
            headers: AUTH_HEADER,
            body: JSON.stringify({
                one_time_password: otp,
                request_token: otpToken
            })
        })
        .then(res => res.json())
        .then(res => {
            if (res.status === 1) {
                closeOtpModal();
                submitLeadForm();
            } else {
                $("#otp-error").text(res.message || "Invalid OTP");
                finalFormData.mobile_verified = 0;
                enableContinueBtn();
            }
        })
        .catch(() => {
            $("#otp-error").text("OTP verification failed");
            enableContinueBtn();
        });
    });
			


    function submitLeadForm() {

        if (finalFormData.mobile_verified === undefined) {
            finalFormData.mobile_verified = 1;
        }

        const apiUrl = isLeadCourse(crsId)
            ? "https://ws-api.wscubetech.com/webapi/services/lead-otp"
            : "https://ws-api.wscubetech.com/webapi/services/web/lead-store-web";

        return fetch(apiUrl, {
            method: "POST",
            headers: AUTH_HEADER,
            body: JSON.stringify(finalFormData)
        })
        .then(res => res.json())
        .then(res => {
            window.location.href = "/blog/thank-you";
            return res;
        });
    }

});



// auto number add 
document.addEventListener("DOMContentLoaded", function () {

    const otpInputs = document.querySelectorAll(".otp-box");

    otpInputs.forEach((input, index) => {

        input.addEventListener("focus", function () {
            this.style.boxShadow = "5px 5px 0px black";
            this.style.outline = "none";
            this.style.transition = "box-shadow 0.2s ease";
        });

        input.addEventListener("blur", function () {
            this.style.boxShadow = "none";
        });

        input.addEventListener("input", function () {

            this.value = this.value.replace(/[^0-9]/g, "");

            if (this.value && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });

        input.addEventListener("keydown", function (e) {

            if (e.key === "Backspace" && !this.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });

        input.addEventListener("paste", function (e) {
            e.preventDefault();

            const pastedData = (e.clipboardData || window.clipboardData)
                .getData("text")
                .replace(/\D/g, "");

            otpInputs.forEach((box, i) => {
                box.value = pastedData[i] || "";
            });

            if (pastedData.length > 0) {
                otpInputs[Math.min(pastedData.length - 1, otpInputs.length - 1)].focus();
            }
        });

    });

});








