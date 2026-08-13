import type { Locale } from "../core/types.ts";

export interface PrivacySection {
  heading: string;
  body: string;
}

export interface PrivacyDocument {
  locale: Locale;
  htmlLang: string;
  title: string;
  updated: string;
  noticeLead: string;
  noticeRest: string;
  sections: readonly PrivacySection[];
  issuesPhrase: string;
}

export const PRIVACY_ISSUES_URL = "https://github.com/orfeomorello/OpenSource-Mobile-Spin-Roulette/issues";
export const PRIVACY_UPDATED_ISO = "2026-08-13";

export const PRIVACY_PAGE_SLUGS: Record<Locale, string> = {
  en: "en",
  it: "it",
  es: "es",
  "pt-BR": "pt-BR",
  fr: "fr",
  de: "de",
  ko: "ko",
  ja: "ja",
  zh: "zh",
};

export function escapePrivacyHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function privacyDocument(locale: Locale): PrivacyDocument {
  return PRIVACY_BY_LOCALE[locale] ?? PRIVACY_BY_LOCALE.en;
}

export function privacyStorePath(locale: Locale): string {
  return `privacy/${PRIVACY_PAGE_SLUGS[locale]}.html`;
}

export function allPrivacyDocuments(): PrivacyDocument[] {
  return (Object.keys(PRIVACY_PAGE_SLUGS) as Locale[]).map((id) => privacyDocument(id));
}

export function privacyArticleMarkup(doc: PrivacyDocument, options?: { issuesUrl?: string }): string {
  const notice = `<p class="privacy-notice"><strong>${escapePrivacyHtml(doc.noticeLead)}</strong> ${escapePrivacyHtml(doc.noticeRest)}</p>`;
  const sections = doc.sections.map((section) => {
    let body = escapePrivacyHtml(section.body);
    if (options?.issuesUrl && doc.issuesPhrase) {
      const phrase = escapePrivacyHtml(doc.issuesPhrase);
      body = body.replace(
        phrase,
        `<a href="${escapePrivacyHtml(options.issuesUrl)}" rel="noopener noreferrer" target="_blank">${phrase}</a>`,
      );
    }
    return `<h2>${escapePrivacyHtml(section.heading)}</h2>\n      <p>${body}</p>`;
  }).join("\n\n      ");
  return `<p class="privacy-updated">${escapePrivacyHtml(doc.updated)}</p>\n      ${notice}\n\n      ${sections}`;
}

const PRIVACY_BY_LOCALE: Record<Locale, PrivacyDocument> = {
  en: {
    locale: "en",
    htmlLang: "en",
    title: "Privacy Policy",
    updated: "Last updated: 13 August 2026",
    noticeLead: "MobileSpinRoulette uses virtual points only.",
    noticeRest: "It offers no real-money gambling, purchases, cash-out, prizes or accounts.",
    issuesPhrase: "GitHub issue tracker",
    sections: [
      {
        heading: "Data collection",
        body: "The app does not collect, transmit, sell or share personal data. It has no analytics, advertising SDK, tracking technology, account system or remote game-data server.",
      },
      {
        heading: "Data stored on your device",
        body: "Score, settings, selected language, saved strategies and the current game session are stored locally in your browser storage. This data remains on your device unless you export a backup yourself.",
      },
      {
        heading: "Your controls and retention",
        body: "You can export, import or erase local data from Settings → Your data. Uninstalling the app or clearing its site data may also remove it. The project does not retain a server copy.",
      },
      {
        heading: "Device features and network access",
        body: "The app may use optional vibration for touch feedback and browser storage for progress. Game assets and optional music are loaded from the same host as the app. Following the GitHub link leaves the app and is governed by GitHub’s own privacy policy.",
      },
      {
        heading: "Children and simulated gambling",
        body: "The app simulates roulette for entertainment and strategy testing. Parents and guardians should decide whether this gambling-themed content is appropriate for a minor in their jurisdiction.",
      },
      {
        heading: "Changes and contact",
        body: "Material changes will be published on this page with a new revision date. Privacy questions can be submitted through the project’s GitHub issue tracker; do not include sensitive personal information in a public issue.",
      },
    ],
  },
  it: {
    locale: "it",
    htmlLang: "it",
    title: "Informativa sulla privacy",
    updated: "Ultimo aggiornamento: 13 agosto 2026",
    noticeLead: "MobileSpinRoulette usa esclusivamente punti virtuali.",
    noticeRest: "Non offre gioco con denaro reale, acquisti, conversione in denaro, premi o account.",
    issuesPhrase: "issue tracker GitHub",
    sections: [
      {
        heading: "Raccolta dei dati",
        body: "L’app non raccoglie, trasmette, vende o condivide dati personali. Non contiene analytics, pubblicità, tecnologie di tracciamento, account o server remoto per i dati di gioco.",
      },
      {
        heading: "Dati conservati sul dispositivo",
        body: "Punteggio, impostazioni, lingua, strategie e sessione di gioco sono conservati localmente nello spazio di archiviazione del browser. Restano sul dispositivo, salvo il backup esportato volontariamente dall’utente.",
      },
      {
        heading: "Controlli e conservazione",
        body: "Da Impostazioni → I tuoi dati puoi esportare, importare o cancellare i dati locali. Anche la disinstallazione o la cancellazione dei dati del sito può rimuoverli. Il progetto non conserva copie su un server.",
      },
      {
        heading: "Funzioni del dispositivo e rete",
        body: "L’app può usare la vibrazione facoltativa per il feedback tattile e lo spazio del browser per i progressi. Asset e musica opzionale provengono dallo stesso host dell’app. Aprendo il collegamento a GitHub si lascia l’app e si applica l’informativa di GitHub.",
      },
      {
        heading: "Minori e gioco simulato",
        body: "L’app simula la roulette per intrattenimento e verifica di strategie. Genitori e tutori devono valutare se il tema del gioco d’azzardo sia appropriato per un minore nella propria giurisdizione.",
      },
      {
        heading: "Modifiche e contatti",
        body: "Le modifiche sostanziali saranno pubblicate su questa pagina con una nuova data di revisione. Per domande sulla privacy è disponibile l’issue tracker GitHub; non inserire informazioni personali sensibili in una segnalazione pubblica.",
      },
    ],
  },
  es: {
    locale: "es",
    htmlLang: "es",
    title: "Política de privacidad",
    updated: "Última actualización: 13 de agosto de 2026",
    noticeLead: "MobileSpinRoulette usa únicamente puntos virtuales.",
    noticeRest: "No ofrece juego con dinero real, compras, cobros, premios ni cuentas.",
    issuesPhrase: "sistema de incidencias de GitHub",
    sections: [
      {
        heading: "Recogida de datos",
        body: "La aplicación no recoge, transmite, vende ni comparte datos personales. No incluye analíticas, SDK publicitarios, tecnologías de seguimiento, cuentas ni un servidor remoto de datos de juego.",
      },
      {
        heading: "Datos guardados en el dispositivo",
        body: "La puntuación, la configuración, el idioma, las estrategias guardadas y la sesión de juego se almacenan en el espacio local del navegador. Permanecen en el dispositivo salvo que exportes una copia de seguridad.",
      },
      {
        heading: "Controles y conservación",
        body: "Desde Ajustes → Tus datos puedes exportar, importar o borrar los datos locales. Desinstalar la aplicación o borrar los datos del sitio también puede eliminarlos. El proyecto no conserva una copia en un servidor.",
      },
      {
        heading: "Funciones del dispositivo y red",
        body: "La aplicación puede usar la vibración opcional para el feedback táctil y el almacenamiento del navegador para el progreso. Los recursos y la música opcional se cargan desde el mismo servidor que la aplicación. El enlace a GitHub sale de la aplicación y se rige por la política de privacidad de GitHub.",
      },
      {
        heading: "Menores y juego simulado",
        body: "La aplicación simula la ruleta para entretenimiento y prueba de estrategias. Padres y tutores deben decidir si este contenido de temática de apuestas es apropiado para un menor en su jurisdicción.",
      },
      {
        heading: "Cambios y contacto",
        body: "Los cambios sustanciales se publicarán en esta página con una nueva fecha de revisión. Las preguntas de privacidad pueden enviarse a través del sistema de incidencias de GitHub; no incluyas información personal sensible en una incidencia pública.",
      },
    ],
  },
  "pt-BR": {
    locale: "pt-BR",
    htmlLang: "pt-BR",
    title: "Política de privacidade",
    updated: "Última atualização: 13 de agosto de 2026",
    noticeLead: "O MobileSpinRoulette usa apenas pontos virtuais.",
    noticeRest: "Não oferece jogo com dinheiro real, compras, saques, prêmios ou contas.",
    issuesPhrase: "rastreador de issues do GitHub",
    sections: [
      {
        heading: "Coleta de dados",
        body: "O aplicativo não coleta, transmite, vende nem compartilha dados pessoais. Não tem analytics, SDK de publicidade, tecnologia de rastreamento, contas nem servidor remoto de dados de jogo.",
      },
      {
        heading: "Dados armazenados no dispositivo",
        body: "Pontuação, configurações, idioma, estratégias salvas e a sessão atual ficam no armazenamento local do navegador. Esses dados permanecem no dispositivo, salvo se você exportar um backup.",
      },
      {
        heading: "Controles e retenção",
        body: "Em Configurações → Seus dados você pode exportar, importar ou apagar os dados locais. Desinstalar o app ou limpar os dados do site também pode removê-los. O projeto não guarda uma cópia em servidor.",
      },
      {
        heading: "Recursos do dispositivo e rede",
        body: "O app pode usar vibração opcional para feedback tátil e o armazenamento do navegador para o progresso. Recursos e música opcional vêm do mesmo host do app. O link do GitHub sai do app e segue a política de privacidade do GitHub.",
      },
      {
        heading: "Crianças e jogo simulado",
        body: "O app simula a roleta para entretenimento e teste de estratégias. Pais e responsáveis devem decidir se este conteúdo com tema de apostas é adequado para um menor em sua jurisdição.",
      },
      {
        heading: "Alterações e contato",
        body: "Mudanças relevantes serão publicadas nesta página com uma nova data de revisão. Dúvidas de privacidade podem ser enviadas pelo rastreador de issues do GitHub; não inclua informações pessoais sensíveis em um issue público.",
      },
    ],
  },
  fr: {
    locale: "fr",
    htmlLang: "fr",
    title: "Politique de confidentialité",
    updated: "Dernière mise à jour : 13 août 2026",
    noticeLead: "MobileSpinRoulette utilise uniquement des points virtuels.",
    noticeRest: "Il n’offre ni jeu d’argent réel, ni achats, ni retrait, ni prix, ni comptes.",
    issuesPhrase: "suivi des tickets GitHub",
    sections: [
      {
        heading: "Collecte des données",
        body: "L’application ne collecte, ne transmet, ne vend ni ne partage de données personnelles. Elle n’inclut ni analytique, ni SDK publicitaire, ni technologie de suivi, ni comptes, ni serveur distant de données de jeu.",
      },
      {
        heading: "Données stockées sur l’appareil",
        body: "Le score, les réglages, la langue, les stratégies enregistrées et la session de jeu sont stockés localement dans le navigateur. Ces données restent sur l’appareil, sauf si vous exportez une sauvegarde.",
      },
      {
        heading: "Contrôles et conservation",
        body: "Depuis Réglages → Vos données, vous pouvez exporter, importer ou effacer les données locales. Désinstaller l’application ou effacer les données du site peut aussi les supprimer. Le projet ne conserve aucune copie sur un serveur.",
      },
      {
        heading: "Fonctions de l’appareil et réseau",
        body: "L’application peut utiliser une vibration facultative pour le retour tactile et le stockage du navigateur pour la progression. Les ressources et la musique facultative proviennent du même hôte que l’application. Le lien GitHub quitte l’application et relève de la politique de confidentialité de GitHub.",
      },
      {
        heading: "Mineurs et jeu simulé",
        body: "L’application simule la roulette pour le divertissement et le test de stratégies. Les parents et tuteurs doivent décider si ce contenu sur le thème des jeux d’argent convient à un mineur dans leur juridiction.",
      },
      {
        heading: "Modifications et contact",
        body: "Les changements importants seront publiés sur cette page avec une nouvelle date de révision. Les questions de confidentialité peuvent être envoyées via le suivi des tickets GitHub ; n’incluez pas d’informations personnelles sensibles dans un ticket public.",
      },
    ],
  },
  de: {
    locale: "de",
    htmlLang: "de",
    title: "Datenschutzerklärung",
    updated: "Zuletzt aktualisiert: 13. August 2026",
    noticeLead: "MobileSpinRoulette verwendet ausschließlich virtuelle Punkte.",
    noticeRest: "Es gibt kein Echtgeldspiel, keine Käufe, keine Auszahlung, keine Preise und keine Konten.",
    issuesPhrase: "GitHub-Issue-Tracker",
    sections: [
      {
        heading: "Datenerhebung",
        body: "Die App erhebt, überträgt, verkauft oder teilt keine personenbezogenen Daten. Sie enthält keine Analysen, Werbe-SDKs, Tracking-Technologien, Konten oder einen entfernten Spieldatenserver.",
      },
      {
        heading: "Auf dem Gerät gespeicherte Daten",
        body: "Punktestand, Einstellungen, Sprache, gespeicherte Strategien und die aktuelle Spielsitzung werden lokal im Browserspeicher abgelegt. Diese Daten bleiben auf dem Gerät, sofern Sie nicht selbst eine Sicherung exportieren.",
      },
      {
        heading: "Kontrollen und Speicherdauer",
        body: "Unter Einstellungen → Ihre Daten können Sie lokale Daten exportieren, importieren oder löschen. Das Deinstallieren der App oder das Löschen der Websitedaten kann sie ebenfalls entfernen. Das Projekt behält keine Serverkopie.",
      },
      {
        heading: "Gerätefunktionen und Netzwerk",
        body: "Die App kann optionale Vibration für taktiles Feedback und den Browserspeicher für den Fortschritt nutzen. Spielinhalte und optionale Musik kommen vom selben Host wie die App. Der GitHub-Link verlässt die App und unterliegt der Datenschutzrichtlinie von GitHub.",
      },
      {
        heading: "Minderjährige und simuliertes Glücksspiel",
        body: "Die App simuliert Roulette zu Unterhaltungs- und Strategiezwecken. Eltern und Erziehungsberechtigte sollten entscheiden, ob diese glücksspielbezogene Darstellung für Minderjährige in ihrer Rechtsordnung geeignet ist.",
      },
      {
        heading: "Änderungen und Kontakt",
        body: "Wesentliche Änderungen werden auf dieser Seite mit neuem Datum veröffentlicht. Datenschutzfragen können über den GitHub-Issue-Tracker gestellt werden; geben Sie in einem öffentlichen Issue keine sensiblen personenbezogenen Daten an.",
      },
    ],
  },
  ko: {
    locale: "ko",
    htmlLang: "ko",
    title: "개인정보 처리방침",
    updated: "최종 업데이트: 2026년 8월 13일",
    noticeLead: "MobileSpinRoulette는 가상 점수만 사용합니다.",
    noticeRest: "실제 돈 도박, 구매, 현금화, 경품, 계정은 제공하지 않습니다.",
    issuesPhrase: "GitHub 이슈 트래커",
    sections: [
      {
        heading: "데이터 수집",
        body: "이 앱은 개인정보를 수집, 전송, 판매 또는 공유하지 않습니다. 분석 도구, 광고 SDK, 추적 기술, 계정 시스템, 원격 게임 데이터 서버가 없습니다.",
      },
      {
        heading: "기기에 저장되는 데이터",
        body: "점수, 설정, 언어, 저장된 전략, 현재 게임 세션은 브라우저 저장소에 로컬로 보관됩니다. 직접 백업을 내보내지 않는 한 이 데이터는 기기에 남습니다.",
      },
      {
        heading: "제어 및 보관",
        body: "설정 → 내 데이터에서 로컬 데이터를 내보내거나 가져오거나 지울 수 있습니다. 앱을 삭제하거나 사이트 데이터를 지워도 삭제될 수 있습니다. 이 프로젝트는 서버 사본을 보관하지 않습니다.",
      },
      {
        heading: "기기 기능과 네트워크",
        body: "앱은 터치 피드백을 위한 선택적 진동과 진행 저장을 위한 브라우저 저장소를 사용할 수 있습니다. 게임 자산과 선택적 음악은 앱과 같은 호스트에서 불러옵니다. GitHub 링크는 앱을 벗어나며 GitHub 자체 개인정보 처리방침이 적용됩니다.",
      },
      {
        heading: "미성년자와 시뮬레이션 도박",
        body: "이 앱은 오락과 전략 연습을 위해 룰렛을 시뮬레이션합니다. 보호자는 해당 관할권에서 이 도박 테마 콘텐츠가 미성년자에게 적절한지 판단해야 합니다.",
      },
      {
        heading: "변경 및 문의",
        body: "중요한 변경 사항은 이 페이지에 새 개정일과 함께 게시됩니다. 개인정보 관련 질문은 GitHub 이슈 트래커로 보낼 수 있습니다. 공개 이슈에 민감한 개인정보를 넣지 마세요.",
      },
    ],
  },
  ja: {
    locale: "ja",
    htmlLang: "ja",
    title: "プライバシーポリシー",
    updated: "最終更新: 2026年8月13日",
    noticeLead: "MobileSpinRoulette は仮想ポイントのみを使用します。",
    noticeRest: "現金ギャンブル、購入、換金、賞品、アカウントはありません。",
    issuesPhrase: "GitHub の Issue トラッカー",
    sections: [
      {
        heading: "データの収集",
        body: "本アプリは個人データを収集、送信、販売、共有しません。分析、広告 SDK、追跡技術、アカウント、遠隔のゲームデータサーバーはありません。",
      },
      {
        heading: "端末に保存されるデータ",
        body: "スコア、設定、言語、保存した戦略、現在のゲームセッションはブラウザのローカルストレージに保存されます。バックアップを書き出さない限り、このデータは端末に残ります。",
      },
      {
        heading: "操作と保持",
        body: "設定 → あなたのデータ から、ローカルデータの書き出し、取り込み、削除ができます。アプリの削除やサイトデータの消去でも削除される場合があります。本プロジェクトはサーバー上のコピーを保持しません。",
      },
      {
        heading: "端末機能とネットワーク",
        body: "アプリは任意の振動フィードバックと、進行状況のためのブラウザ保存領域を使うことがあります。ゲーム資産と任意の音楽はアプリと同じホストから読み込まれます。GitHub リンクはアプリを離れ、GitHub 自身のプライバシーポリシーが適用されます。",
      },
      {
        heading: "未成年者と模擬ギャンブル",
        body: "本アプリは娯楽と戦略の検証のためにルーレットを模擬します。保護者は、居住地の法令のもとでこのギャンブル題材が未成年者に適切かを判断してください。",
      },
      {
        heading: "変更と連絡先",
        body: "重要な変更はこのページに新しい改定日とともに掲載します。プライバシーに関する質問は GitHub の Issue トラッカーへ送れます。公開 Issue に機微な個人情報を書かないでください。",
      },
    ],
  },
  zh: {
    locale: "zh",
    htmlLang: "zh-CN",
    title: "隐私政策",
    updated: "最近更新：2026年8月13日",
    noticeLead: "MobileSpinRoulette 仅使用虚拟积分。",
    noticeRest: "不提供真钱赌博、内购、提现、奖品或账户。",
    issuesPhrase: "GitHub 议题跟踪器",
    sections: [
      {
        heading: "数据收集",
        body: "本应用不收集、传输、出售或共享个人数据。没有分析工具、广告 SDK、跟踪技术、账户系统或远程游戏数据服务器。",
      },
      {
        heading: "保存在本机的数据",
        body: "分数、设置、语言、已保存策略和当前对局会话保存在浏览器本地存储中。除非你自行导出备份，否则这些数据只留在本机。",
      },
      {
        heading: "控制与保留",
        body: "可在 设置 → 你的数据 中导出、导入或清除本地数据。卸载应用或清除网站数据也可能删除它们。本项目不在服务器上保留副本。",
      },
      {
        heading: "设备功能与网络",
        body: "应用可选用振动作为触感反馈，并用浏览器存储保存进度。游戏资源和可选音乐来自与应用相同的主机。打开 GitHub 链接会离开应用，并适用 GitHub 自己的隐私政策。",
      },
      {
        heading: "未成年人与模拟赌博",
        body: "本应用模拟轮盘，仅供娱乐和策略练习。监护人应自行判断此类赌博题材内容在其所在司法辖区是否适合未成年人。",
      },
      {
        heading: "变更与联系",
        body: "重大变更将发布在本页并更新日期。隐私问题可通过 GitHub 议题跟踪器提交；请勿在公开议题中填写敏感个人信息。",
      },
    ],
  },
};
