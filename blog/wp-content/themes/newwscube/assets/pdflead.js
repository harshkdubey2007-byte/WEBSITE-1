//pdf-model-lead

// Education API Fetch 
let educations = document.querySelector('#cf-edu1');

fetch("https://ws-api.wscubetech.com/webapi/services/get-educations", {
    method: "GET",
    headers: {
        "Authorization": "Basic d3NjdWJldGVjaDp3c2N1YmV0ZWNoQDEyMyEh",
        "Content-Type": "application/json"
    }
})
.then(res => res.json())
.then(data => {
    if (educations) {
        educations.innerHTML = `<option value="">Select Highest Education</option>`;
        data.result.forEach(item => {
            let option = document.createElement("option");
            option.value = item.id;
            option.textContent = item.name;
            educations.appendChild(option);
        });
    }
})
.catch(err => {
    console.error("Fetch Error:", err);
});


// Country / Century API Fetch
let Country1 = document.querySelector('#cf-century1');

fetch("https://ws-api.wscubetech.com/webapi/services/get-countries", {
    method: "GET",
    headers: {
        "Authorization": "Basic d3NjdWJldGVjaDp3c2N1YmV0ZWNoQDEyMyEh",
        "Content-Type": "application/json"
    }
})
.then(res => res.json())
.then(data => {
    if (Country1) {
        Country1.innerHTML = `<option value="">Select Century</option>`;
        data.result.forEach(item => {
            let option = document.createElement("option");
            option.value = item.id;
            option.textContent = item.name;
            Country1.appendChild(option);
        });
    }
})
.catch(err => {
    console.error("Fetch Error:", err);
});


// Lead Form Logic
jQuery(document).ready(function ($) {

    const AUTH_HEADER = {
        "Authorization": "Basic d3NjdWJldGVjaDp3c2N1YmV0ZWNoQDEyMyEh",
        "Content-Type": "application/json"
    };

    let finalFormDatas = null;
    let otpTokens = null;
    let crsIds = null;
    let otpModalInstances = null;

    /* ==============================
       Phone Input Init
    ============================== */
    const input = document.querySelector("#cf-phone1");
    let iti = null;
    if (input) {
        iti = window.intlTelInput(input, {
            separateDialCode: true,
            initialCountry: "in",
            preferredCountries: ["in", "us", "gb", "ca"],
            utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.13/js/utils.js"
        });
    }

    function isLeadCourse(courseId) {
        return courseId === "47" || courseId === "8" || courseId === "9";
    }

    /* ==============================
       TOGGLE EMAIL & CENTURY BOX
    ============================= */
    function toggleEmailBox1() {
        if (!iti) return;
        const countryCode = iti.getSelectedCountryData().dialCode;

        if (countryCode !== "91") {
            $("#email-box1").removeClass("d-none");
        } else {
            $("#email-box1").addClass("d-none");
            $("#cf-email1").val("");
            $("#err-email1").text("");
        }
    }
	
	function toggleCenturyBox(courseId) {
		if (courseId === "5" || courseId === "6") {
			$("#century-box1").removeClass("d-none");
		} else {
			$("#century-box1").addClass("d-none");
			$("#cf-century1").val("");
			$("#err-century1").text("");
		}
	}
	

    if (input && iti) {
        input.addEventListener("input", function () {
            const countryCode = iti.getSelectedCountryData().dialCode;
            let value = this.value.replace(/\D/g, "");

            // India (+91) ke liye sirf 10 digits
            if (countryCode === "91" && value.length > 10) {
                value = value.substring(0, 10);
            }
            this.value = value;
        });

        input.addEventListener("countrychange", function () {
            this.value = "";
            toggleEmailBox1(); // Fixed typo from toggleEmailBoxs / toggleEmailBoxss
        });
    }

    $("#cf-course1").on("change", function () {
        const courseId = $(this).val();
        toggleCenturyBox(leadData2.course_id);
    });

    function openOtpModal() {
        const el = document.getElementById("otpModal");
        if (!el) return;

        const careerModalEl = document.getElementById("careerModal1");
        const careerModal = bootstrap.Modal.getInstance(careerModalEl);
        if (careerModal) careerModal.hide();

        if (finalFormDatas && finalFormDatas.mobile_number && finalFormDatas.country_code) {
            const mobileText = `+${finalFormDatas.country_code} ${finalFormDatas.mobile_number}`;
            const mobileEl = document.getElementById("otp-mobile");
            if (mobileEl) mobileEl.textContent = mobileText;
        }

        otpModalInstances = new bootstrap.Modal(el, {
            backdrop: "static",
            keyboard: false
        });
        otpModalInstances.show();
    }

    function closeOtpModal() {
        if (otpModalInstances) otpModalInstances.hide();
    }

    /* ==============================
       BUTTON HELPERS
    ============================== */
    function disableContinueBtn1() {
        $("#continueBtn1").prop("disabled", true); // Fixed selector from "#1" to "#continueBtn1"
        $("#continueBtn1 .btn-text").addClass("d-none");
        $("#btnLoader1").removeClass("d-none");
    }

    function enableContinueBtn1() {
        $("#continueBtn1").prop("disabled", false);
        $("#continueBtn1 .btn-text").removeClass("d-none");
        $("#btnLoader1").addClass("d-none");
    }
	
	//shortcode-data
	
	let leadData2 = {};

	const pdfDataSource = document.querySelector(".pdf-btn");

	if (pdfDataSource) {
		leadData2 = {
			course_id: pdfDataSource.dataset.courseId,
			lead_note: "Get Free Career Counselling - Blog",
			cta_title: pdfDataSource.dataset.ctaTitle,
			utm_source: pdfDataSource.dataset.utmSource,
			utm_medium: pdfDataSource.dataset.utmMedium,
			utm_campaign: pdfDataSource.dataset.utmCampaign,
		};
		toggleCenturyBox(leadData2.course_id);

	}
	
	//end-shortcode-data
	
//resend-otp

let timer;
let timeLeft = 60;

function startOtpTimer() {

    clearInterval(timer);

    timeLeft = 60;

    $("#otp-timer").removeClass("d-none");
    $("#resend-box").addClass("d-none");

    $("#countdown").text(timeLeft);

    timer = setInterval(function () {

        timeLeft--;

        $("#countdown").text(timeLeft);

        if (timeLeft <= 0) {
            clearInterval(timer);

            $("#otp-timer").addClass("d-none");
            $("#resend-box").removeClass("d-none");
        }

    }, 1000);
}


    /* ==============================
       FORM SUBMIT
    ============================== */
    $("#pdfCounsellingForm").on("submit", function (e) {
        e.preventDefault();

        if (!iti) return;

        disableContinueBtn1(); 
        $(".error-msg").text("");

        const names = $("#cf-name1").val().trim();
        const educationsVal = $("#cf-edu1").val();
        const courseVal = $("#cf-course1").val() || ""; // Handled safe fallback if commented out
        const centurys = $("#cf-century1").val();
        const countryCodes = iti.getSelectedCountryData().dialCode;

        const mobiles = iti
            .getNumber(window.intlTelInputUtils.numberFormat.NATIONAL)
            .replace(/\D/g, "")
            .replace(/^0+/, "");

        const emails = $("#cf-email1").val().trim();

        crsIds = courseVal;
        let hasError = false;

        if (!names) {
            $("#err-name1").text("Please enter name");
            hasError = true;
        }

        if (countryCodes === "91" && !iti.isValidNumber()) {
            $("#err-phone1").text("Invalid mobile number");
            hasError = true;
        }

        if (countryCodes !== "91" && !emails) { // Fixed undefined 'email' to 'emails'
            $("#err-email1").text("Email required");
            hasError = true;
        }

        if (!educationsVal) {
            $("#err-edu1").text("Select education");
            hasError = true;
        }

        // Validate course only if dropdown exists in HTML
        if ($("#cf-course1").length && !courseVal) {
            $("#err-course1").text("Select course");
            hasError = true;
        }

        if ((courseVal === "8" || courseVal === "9") && !centurys) { // Fixed undefined 'century' & 'course'
            $("#err-century1").text("Please select country");
            hasError = true;
        }

        if (hasError) {
            enableContinueBtn1(); // Fixed 'enable1()' to 'enableContinueBtn1()'
            return;
        }

        finalFormDatas = {
			name: names,
			mobile_number: mobiles,
			country_code: countryCodes,
			email: emails,
			education_id: educationsVal,
			course_id: leadData2.course_id,
			century: centurys,
			course_type_request: "Online",
			lead_note: leadData2.lead_note,
			lead_mode: 1,
			lead_source_id: 16,
			page_type: "Blog",
			cta_title: leadData2.cta_title,
			utm_source: leadData2.utm_source,
			utm_medium: leadData2.utm_medium,
			utm_campaign: leadData2.utm_campaign
		};

        const careerModal = bootstrap.Modal.getInstance(
            document.getElementById("careerModal1")
        );
        if (careerModal) careerModal.hide();

        if (countryCodes === "91") { 
            sendLeadOtps();
        } else {
            submitLeadForms();
        }
    });

    function sendLeadOtps() {
        const apiUrl = isLeadCourse(crsIds)
            ? "https://ws-api.wscubetech.com/webapi/services/lead-otp"
            : "https://ws-api.wscubetech.com/webapi/services/web/lead-store-web";

        fetch(apiUrl, {
            method: "POST",
            headers: AUTH_HEADER,
            body: JSON.stringify(finalFormDatas)
        })
        .then(res => res.json())
        .then(res => {
//             openOtpModal();
// 			startOtpTimer();
            if (res.status === 1) {
                if (res.result?.mobile_number_verified === true) {
                    submitLeadForms();
                } else if (res.result?.request_token) {
                    otpTokens = res.result.request_token;
                    openOtpModal();
					startOtpTimer();
                }
            } else {
                if (typeof reactToast === 'function') reactToast(res.message || "OTP send failed");
                enableContinueBtn1();
            }
        })
        .catch(() => {
            if (typeof reactToast === 'function') reactToast("Something went wrong");
            enableContinueBtn1();
        });
    }

	$("#resendOtp").on("click", function (e) {

		e.preventDefault();

		fetch("https://ws-api.wscubetech.com/webapi/services/web/resend-otp", {
			method: "POST",
			headers: AUTH_HEADER,
			body: JSON.stringify({
				type: "mobile",
				country_code: finalFormDatas.country_code,
				phone_number: finalFormDatas.mobile_number
			})
		})
		.then(res => res.json())
		.then(res => {

			if (res.status === 1) {
				startOtpTimer();
				reactToast("OTP resent successfully");
			} else {
				reactToast(res.message || "Resend OTP failed");
			}

		})
		.catch(() => {
			reactToast("Something went wrong");
		});

	});

    $("#verifyOtpBtn").on("click", function () {
        let otp = "";
        $(".otp-box").each(function () {
            otp += $(this).val();
        });

        if (otp.length !== 6) {
            $("#otp-error").text("Enter 6 digit OTP");
            return;
        }

        if (!otpTokens) {
            $("#otp-error").text("OTP token missing");
            return;
        }

        const verifyApi = isLeadCourse(crsIds)
            ? "https://ws-api.wscubetech.com/webapi/services/web/verify-otp"
            : "https://ws-api.wscubetech.com/webapi/services/lead-mobile-verify";

        fetch(verifyApi, {
            method: "POST",
            headers: AUTH_HEADER,
            body: JSON.stringify({
                one_time_password: otp,
                request_token: otpTokens
            })
        })
        .then(res => res.json())
        .then(res => {
            if (res.status === 1) {
                closeOtpModal();
                submitLeadForms();
            } else {
                $("#otp-error").text(res.message || "Invalid OTP");
                finalFormDatas.mobile_verified = 0;
                enableContinueBtn1();
            }
        })
        .catch(() => {
            $("#otp-error").text("OTP verification failed");
            enableContinueBtn1();
        });
    });

    function submitLeadForms() {
        if (finalFormDatas.mobile_verified === undefined) {
            finalFormDatas.mobile_verified = 1;
        }

        const apiUrl = isLeadCourse(crsIds)
            ? "https://ws-api.wscubetech.com/webapi/services/lead-otp"
            : "https://ws-api.wscubetech.com/webapi/services/web/lead-store-web";

        return fetch(apiUrl, {
            method: "POST",
            headers: AUTH_HEADER,
            body: JSON.stringify(finalFormDatas)
        })
        .then(res => res.json())
        .then(res => {
			console.log(res)
            document.dispatchEvent(new Event("leadFormSuccess"));
            return res;
        });
    }
});