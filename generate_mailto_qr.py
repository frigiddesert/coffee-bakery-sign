import argparse
import urllib.parse

import qrcode


def build_mailto_link(email: str, subject: str) -> str:
    quoted_subject = urllib.parse.quote(subject, safe="")
    return f"mailto:{email}?subject={quoted_subject}"


def main():
    parser = argparse.ArgumentParser(
        description="Generate a QR code that opens an email draft with the BAKEPLAN subject."
    )
    parser.add_argument(
        "--email",
        default="bakingatvillageroaster.z6mbz32@gmail.com",
        help="Destination email address",
    )
    parser.add_argument(
        "--subject",
        default="BAKEPLAN",
        help="Full subject line to prefill (include passcode)",
    )
    parser.add_argument("--output", default="mailto_qr.png", help="Output PNG filename")
    args = parser.parse_args()

    mailto = build_mailto_link(args.email, args.subject)
    img = qrcode.make(mailto)
    img.save(args.output)
    print(f"QR code saved to {args.output} with payload: {mailto}")


if __name__ == "__main__":
    main()
