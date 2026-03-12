# Page snapshot

```yaml
- generic [ref=e3]:
  - region "Notifications alt+T"
  - generic [ref=e5]:
    - generic [ref=e6]:
      - img "SOS Logistic Pro Enterprise" [ref=e8]
      - heading "SOS Logistic Pro Enterprise" [level=3] [ref=e9]
      - paragraph [ref=e10]: Sign in to your account to continue
    - generic [ref=e12]:
      - generic [ref=e13]:
        - text: Email
        - textbox "Email" [ref=e14]:
          - /placeholder: admin@example.com
          - text: invalid@example.com
      - generic [ref=e15]:
        - text: Password
        - textbox "Password" [ref=e16]:
          - /placeholder: ••••••••
          - text: invalid-password
      - button "Sign In" [ref=e17] [cursor=pointer]
      - generic [ref=e18]:
        - text: First time setup?
        - link "Create Platform Admin" [ref=e19] [cursor=pointer]:
          - /url: /setup-admin
```