/*
 *  This file is part of CoCalc: Copyright © 2021 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

import { Layout } from "antd";
import { GetServerSidePropsContext } from "next";
import { join } from "path";

import { getRecentHeadlines } from "@cocalc/database/postgres/news";
import { COLORS } from "@cocalc/util/theme";
import { RecentHeadline } from "@cocalc/util/types/news";
import DemoCell from "components/demo-cell";
import CoCalcComFeatures, {
  Hero,
} from "components/landing/cocalc-com-features";
import Content from "components/landing/content";
import Footer from "components/landing/footer";
import Head from "components/landing/head";
import Header from "components/landing/header";
import Info from "components/landing/info";
import { NewsBanner } from "components/landing/news-banner";
import Logo from "components/logo";
import { CSS, Paragraph, Title } from "components/misc";
import A from "components/misc/A";
import ChatGPTHelp from "components/openai/chatgpt-help";
import getAccountId from "lib/account/get-account";
import basePath from "lib/base-path";
import { Customize, CustomizeType } from "lib/customize";
import { PublicPath as PublicPathType } from "lib/share/types";
import withCustomize from "lib/with-customize";
import screenshot from "public/cocalc-screenshot-20200128-nq8.png";

const TOP_LINK_STYLE: CSS = { marginRight: "20px" } as const;

interface Props {
  customize: CustomizeType;
  publicPaths: PublicPathType[];
  recentHeadlines: RecentHeadline[] | null;
  headlineIndex: number;
}

export default function Home(props: Props) {
  const { customize, recentHeadlines, headlineIndex } = props;
  const {
    shareServer,
    siteName,
    siteDescription,
    organizationName,
    organizationURL,
    splashImage,
    indexInfo,
    sandboxProjectId,
    onCoCalcCom,
    openaiEnabled,
    jupyterApiEnabled,
    account,
    isCommercial,
  } = customize;

  function contentDescription() {
    return (
      <Paragraph type="secondary">
        {onCoCalcCom ? (
          <>by Sagemath, Inc.</>
        ) : (
          <>
            An instance of <A href="https://cocalc.com">CoCalc</A>
            {organizationName && organizationURL && (
              <>
                {" "}
                hosted by <A href={organizationURL}>{organizationName}</A>
              </>
            )}
            .
          </>
        )}
      </Paragraph>
    );
  }

  function topAccountLinks() {
    if (!account) return;
    return (
      <div
        style={{
          textAlign: "center",
          margin: "30px 0 15px 0",
        }}
      >
        <Title level={1} style={{ color: COLORS.GRAY }}>
          Signed in as{" "}
          <A href="/config">
            {`${account.first_name} ${account.last_name} ${
              account.name ? "(@" + account.name + ")" : ""
            }`}
          </A>
        </Title>
        <Paragraph style={{ fontSize: "11pt", margin: "15px 0" }}>
          {isCommercial && account && !account.is_anonymous && (
            <>
              <A href="/store" style={TOP_LINK_STYLE}>
                Store
              </A>{" "}
              <a
                href={join(basePath, "settings/licenses")}
                style={TOP_LINK_STYLE}
              >
                Licenses
              </a>{" "}
              <a
                href={join(basePath, "settings/purchases")}
                style={TOP_LINK_STYLE}
              >
                Purchases
              </a>{" "}
              <A href={"/vouchers"} style={TOP_LINK_STYLE}>
                Vouchers
              </A>{" "}
            </>
          )}
          <a href={join(basePath, "projects")} style={TOP_LINK_STYLE}>
            Projects
          </a>{" "}
          {customize.landingPages && (
            <>
              <A href="/features/" style={TOP_LINK_STYLE}>
                Features
              </A>{" "}
              <A href="/software" style={TOP_LINK_STYLE}>
                Software
              </A>{" "}
              {isCommercial && (
                <>
                  <A href="/pricing" style={TOP_LINK_STYLE}>
                    Pricing
                  </A>{" "}
                </>
              )}
            </>
          )}
          <A href={"/config"} style={TOP_LINK_STYLE}>
            Config
          </A>{" "}
          {customize.shareServer && (
            <>
              <A style={TOP_LINK_STYLE} href={"/share/public_paths/page/1"}>
                Share
              </A>{" "}
            </>
          )}
          <>
            <A style={TOP_LINK_STYLE} href="/support">
              Support
            </A>{" "}
            <A style={TOP_LINK_STYLE} href="/info">
              Docs
            </A>
          </>
        </Paragraph>
      </div>
    );
  }

  function renderCoCalcComFeatures() {
    if (!onCoCalcCom) return;
    return (
      <CoCalcComFeatures
        siteName={siteName ?? "CoCalc"}
        shareServer={shareServer ?? false}
        sandboxProjectId={sandboxProjectId}
      />
    );
  }

  function logo(): JSX.Element {
    return <Logo type="full" style={{ width: "50%" }} />;
  }

  function imageAlternative() {
    if (onCoCalcCom) {
      return (
        <div style={{ margin: "0 auto", textAlign: "center" }}>
          <Title level={3}>
            <A href="https://about.cocalc.com">
              Mission and Features of CoCalc
            </A>
          </Title>
          <Paragraph>
            <iframe
              style={{ marginTop: "30px", maxWidth: "100%" }}
              width="672"
              height="378"
              src="https://www.youtube.com/embed/ygVWdH4RKIQ"
              title="YouTube video player"
              frameBorder={0}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </Paragraph>
        </div>
      );
    } else {
      return indexInfo;
    }
  }

  function renderNews() {
    if (recentHeadlines == null) return;
    return (
      <NewsBanner
        recentHeadlines={recentHeadlines}
        headlineIndex={headlineIndex}
      />
    );
  }

  function renderChatGPT() {
    if (!openaiEnabled) return;
    return (
      <Info
        title="LLMs are here to help you"
        icon="robot"
        imageComponent={<ChatGPTHelp size="large" tag={"index"} />}
        anchor="a-realtimesync"
        alt={"Two browser windows editing the same Jupyter notebook"}
        style={{ backgroundColor: COLORS.ANTD_BG_BLUE_L }}
      >
        <Paragraph>
          {siteName}'s file editors are enhanced by{" "}
          <A href={"https://en.wikipedia.org/wiki/Large_language_model"}>
            large language models
          </A>{" "}
          like <A href={"https://doc.cocalc.com/chatgpt.html"}>ChatGPT</A>. They
          help you{" "}
          <A href={"https://doc.cocalc.com/chatgpt.html#jupyter-notebooks"}>
            fixing errors
          </A>
          , generate code or LaTeX snippets, summarize documents, and much more.
        </Paragraph>
      </Info>
    );
  }

  function renderDemoCell() {
    if (!jupyterApiEnabled || !onCoCalcCom) return;

    return (
      <Info
        title="Many programming languages"
        icon="flow-chart"
        imageComponent={<DemoCell tag={"sage"} style={{ width: "100%" }} />}
        anchor="a-realtimesync"
        alt={"Two browser windows editing the same Jupyter notebook"}
        style={{ backgroundColor: COLORS.YELL_LLL }}
      >
        <Paragraph>
          {siteName} supports many{" "}
          <A href={"/software"}>programming languages</A>. Edit the demo cell on
          the left and evaluate it by pressing "Run". You can also select a
          different "kernel", i.e. the programming language that is used to
          evaluate the cell.
        </Paragraph>
      </Info>
    );
  }

  return (
    <Customize value={customize}>
      <Head title={siteDescription ?? "Collaborative Calculation"} />
      <Layout>
        <Header />
        <Layout.Content style={{ backgroundColor: "white" }}>
          {renderNews()}
          {topAccountLinks()}
          <Content
            style={{ minHeight: "30vh" }}
            logo={logo()}
            title={onCoCalcCom ? "" : siteName}
            subtitle={siteDescription}
            description={contentDescription()}
            image={splashImage ? splashImage : screenshot}
            alt={"Screenshot showing CoCalc in action!"}
            imageAlternative={imageAlternative()}
          />
          <Hero />
          {renderChatGPT()}
          {renderDemoCell()}
          {renderCoCalcComFeatures()}
          <Footer />
        </Layout.Content>
      </Layout>
    </Customize>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const isAuthenticated = (await getAccountId(context.req)) != null;

  // get most recent headlines
  const recentHeadlines = await getRecentHeadlines(5);
  // we want not always show the same at the start
  const headlineIndex =
    recentHeadlines != null
      ? Math.floor(Date.now() % recentHeadlines.length)
      : 0;

  return await withCustomize(
    { context, props: { recentHeadlines, headlineIndex, isAuthenticated } },
    { name: true },
  );
}
