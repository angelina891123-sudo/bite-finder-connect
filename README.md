# Foodie Match

我想要做一個網站，是一個提供媒合機會給想找foodie的餐廳以及foodie的平台，主要包括以下三個介面
1. 主要Homepage: foodie在前台看到各個的餐廳發的案件的畫面＆可以按申請，按申請會跳出登入或註冊的頁面
2. homepage右上方會有一個商家後台，餐廳點進去後可以進入到後台頁面，後台功能包括原本肚肚後台就有的功能如一般的銷售管理等等，只是多一個可以進行上架想媒合foodie案件的按鈕在左邊欄(這部分也需要提供上架時會出現的畫面)
3. 我們公司要在後台管理商家＋foodie (管理者的介面)

幫我建立一個餐飲業配媒合平台，使用 Supabase 作為後端。

需要三種使用者角色：商家（merchant）、foodie（creator）、平台管理員（admin）。

請建立商家後台頁面，登入的商家可以：

新增案件（填寫標題、地區、粉絲門檻、合作類型、獎勵、名額、截止日）、

查看自己上架的所有案件、

查看每個案件收到的 foodie 申請並核准或拒絕。

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://bite-finder-connect.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4f9e8e9d-3cf9-4630-ad54-2d1e001f7235).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
