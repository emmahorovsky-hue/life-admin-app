# GitHub Repository Setup

Since GitHub CLI authentication wasn't completed during setup, follow these steps to create the repository and push the code manually.

## Option 1: GitHub Web Interface (Easiest)

### Step 1: Create Repository on GitHub

1. Go to https://github.com/new
2. **Repository name:** `life-admin-app`
3. **Description:** Life Admin App MVP - Subscription Tracker
4. **Visibility:** Public (or Private if preferred)
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### Step 2: Push Existing Code

GitHub will show you commands. Use these:

```bash
cd /Users/anna/.openclaw/workspace/life-admin-app

# Add GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/life-admin-app.git

# Push code
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### Step 3: Verify

Visit your repository at:
```
https://github.com/YOUR_USERNAME/life-admin-app
```

You should see all 26 files committed.

---

## Option 2: GitHub CLI (After Authentication)

### Step 1: Authenticate GitHub CLI

```bash
gh auth login
```

Follow the prompts:
- Where do you use GitHub? **GitHub.com**
- Protocol: **HTTPS** (or SSH if configured)
- Authenticate Git? **Yes**
- How to authenticate? **Login with a web browser** (or paste token)

### Step 2: Create Repository

```bash
cd /Users/anna/.openclaw/workspace/life-admin-app

# Create repo and push
gh repo create life-admin-app --public --source=. --remote=origin --push
```

Or for private:
```bash
gh repo create life-admin-app --private --source=. --remote=origin --push
```

### Step 3: Verify

```bash
gh repo view --web
```

---

## Option 3: SSH (If You Have SSH Keys Set Up)

### Step 1: Create Repository on GitHub

Go to https://github.com/new and create `life-admin-app` (don't initialize).

### Step 2: Push with SSH

```bash
cd /Users/anna/.openclaw/workspace/life-admin-app

# Add SSH remote
git remote add origin git@github.com:YOUR_USERNAME/life-admin-app.git

# Push code
git branch -M main
git push -u origin main
```

---

## After Pushing to GitHub

### 1. Add Description and Topics

On your GitHub repo page:
- Click "About" gear icon
- Add description: "Subscription tracker - Express + React MVP"
- Add topics: `typescript`, `express`, `prisma`, `react`, `subscription-tracker`, `mvp`

### 2. Set Up Branch Protection (Optional)

Settings → Branches → Add rule:
- Branch name pattern: `main`
- Enable: "Require pull request reviews before merging"
- Enable: "Require status checks to pass before merging"

### 3. Create Project Board (Optional)

Projects → New project → Board
- To Do, In Progress, Done columns
- Add cards for frontend tasks

### 4. Enable GitHub Actions (Optional)

See `SETUP.md` for CI/CD configuration.

### 5. Add Collaborators (Optional)

Settings → Collaborators → Add people

---

## Repository Structure on GitHub

After pushing, your repo will look like:

```
life-admin-app/
├── .gitignore
├── README.md                          # Main project README
├── SETUP.md                           # Setup instructions
├── GITHUB_SETUP.md                    # This file
├── client/
│   └── README.md                      # Frontend placeholder
└── server/
    ├── .env.example                   # Environment template
    ├── .gitignore                     # Server-specific ignores
    ├── README.md                      # API documentation
    ├── package.json
    ├── tsconfig.json
    ├── prisma/
    │   ├── schema.prisma              # Database schema
    │   └── seed.ts                    # Seed data
    └── src/
        ├── controllers/               # Business logic
        ├── routes/                    # API routes
        ├── middleware/                # Auth, errors
        ├── utils/                     # DB, JWT helpers
        └── index.ts                   # Express app
```

---

## Next Steps After GitHub Setup

1. ✅ **Code is on GitHub**
2. ⬜ **Set up Railway deployment** (see SETUP.md)
   - Connect GitHub repo
   - Add PostgreSQL
   - Configure environment variables
   - Auto-deploy on push
3. ⬜ **Start frontend development** (Week 1, Days 5-7)
   - Initialize React + Vite in `client/`
   - Connect to backend API
4. ⬜ **Deploy frontend to Vercel**
   - Connect GitHub repo
   - Configure build settings

---

## Troubleshooting

### "remote origin already exists"

```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/life-admin-app.git
```

### "authentication failed"

**For HTTPS:**
Use a Personal Access Token instead of password:
1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. Select scopes: `repo`
4. Use token as password when pushing

**For SSH:**
Check your SSH keys are added:
```bash
ssh -T git@github.com
```

### "unable to access"

Check your internet connection and GitHub status:
https://www.githubstatus.com/

---

## Resources

- [GitHub: Creating a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)
- [GitHub: Pushing commits](https://docs.github.com/en/get-started/using-git/pushing-commits-to-a-remote-repository)
- [GitHub CLI docs](https://cli.github.com/manual/)

---

**Status:** Local Git repository initialized with complete backend code. Ready to push to GitHub.

**Last Updated:** 2026-04-28
