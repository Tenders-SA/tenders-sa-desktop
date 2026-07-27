//! Value-level scrubbing for the native log bridge.
//!
//! Implemented with hand-rolled scanning rather than a regex crate:
//! the patterns are few and fixed, and it keeps the dependency
//! surface of the security-adjacent path small.

pub const REDACTED: &str = "[redacted]";

/// Redacts sensitive substrings from a log value.
pub fn redact(value: &str) -> String {
    let mut out = value.to_string();
    out = redact_bearer_tokens(&out);
    out = redact_api_keys(&out);
    out = redact_jwts(&out);
    out = redact_emails(&out);
    out = redact_currency(&out);
    out = redact_long_digit_runs(&out);
    out
}

/// Replaces whitespace-delimited words matching `predicate`.
fn replace_words<F>(value: &str, predicate: F) -> String
where
    F: Fn(&str) -> bool,
{
    value
        .split_inclusive(char::is_whitespace)
        .map(|chunk| {
            let trimmed = chunk.trim_end();
            let trailing = &chunk[trimmed.len()..];
            if predicate(trimmed) {
                format!("{REDACTED}{trailing}")
            } else {
                chunk.to_string()
            }
        })
        .collect()
}

fn redact_bearer_tokens(value: &str) -> String {
    let lower = value.to_lowercase();
    let Some(index) = lower.find("bearer ") else {
        return value.to_string();
    };
    let rest = &value[index + "bearer ".len()..];
    let end = rest.find(char::is_whitespace).unwrap_or(rest.len());
    format!("{}Bearer {REDACTED}{}", &value[..index], &rest[end..])
}

fn redact_api_keys(value: &str) -> String {
    replace_words(value, |word| {
        let lower = word.to_lowercase();
        lower.starts_with("tsa_prod_") || lower.starts_with("tsa_test_")
    })
}

fn redact_jwts(value: &str) -> String {
    replace_words(value, |word| {
        word.starts_with("eyJ") && word.matches('.').count() == 2
    })
}

fn redact_emails(value: &str) -> String {
    replace_words(value, |word| {
        let at = word.find('@');
        match at {
            Some(index) => index > 0 && word[index + 1..].contains('.'),
            None => false,
        }
    })
}

/// Redacts "R 1 250 000.00" / "ZAR 42.00" style amounts, including the
/// digit groups that follow the currency marker.
fn redact_currency(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut chars = value.char_indices().peekable();

    while let Some((index, ch)) = chars.next() {
        let rest = &value[index..];
        let marker = if rest.to_uppercase().starts_with("ZAR") {
            Some(3)
        } else if (ch == 'R' || ch == 'r')
            && rest[1..]
                .trim_start()
                .starts_with(|c: char| c.is_ascii_digit())
        {
            Some(1)
        } else {
            None
        };

        match marker {
            Some(len) => {
                let after = &rest[len..];
                let amount_len = after
                    .find(|c: char| !(c.is_ascii_digit() || " ,.".contains(c)))
                    .unwrap_or(after.len());
                if after[..amount_len].chars().any(|c| c.is_ascii_digit()) {
                    out.push_str(REDACTED);
                    for _ in 0..(len + amount_len - 1) {
                        chars.next();
                    }
                    continue;
                }
                out.push(ch);
            }
            None => out.push(ch),
        }
    }
    out
}

/// Catches SA ID numbers (13 digits) and card-like runs (16 digits).
fn redact_long_digit_runs(value: &str) -> String {
    replace_words(value, |word| {
        let digits = word.trim_matches(|c: char| !c.is_ascii_digit());
        digits.len() >= 13 && digits.chars().all(|c| c.is_ascii_digit())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_bearer_token() {
        let out = redact("Authorization: Bearer abc.def.ghi trailing");
        assert!(!out.contains("abc.def.ghi"));
        assert!(out.contains("trailing"), "surrounding text must survive");
    }

    #[test]
    fn redacts_api_key() {
        assert!(!redact("key tsa_prod_abc123 used").contains("abc123"));
    }

    #[test]
    fn redacts_jwt() {
        let jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature";
        assert!(!redact(jwt).contains("signature"));
    }

    #[test]
    fn redacts_email() {
        assert!(!redact("mail buyer@example.com now").contains("buyer@example.com"));
    }

    #[test]
    fn redacts_rand_amount() {
        let out = redact("bid R 1 250 000.00 submitted");
        assert!(!out.contains("1 250 000"), "got: {out}");
    }

    #[test]
    fn redacts_sa_id_number() {
        assert!(!redact("id 8001015009087 recorded").contains("8001015009087"));
    }

    #[test]
    fn leaves_operational_text_alone() {
        assert_eq!(
            redact("status pending attempt 2"),
            "status pending attempt 2"
        );
    }
}
