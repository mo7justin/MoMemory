"use client";
import React from "react";
import { useTheme } from 'next-themes';
import { Moon, Sun, Languages } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/components/shared/LanguageContext';
import { t } from '@/lib/locales';

export default function PrivacyPolicyPage() {
  const { setTheme, theme } = useTheme();
  const { locale, setLocale } = useLanguage();
  const isZhCN = String(locale).toLowerCase() === 'zh-cn';
  const isZhTW = String(locale).toLowerCase() === 'zh-tw';
  return (
    <div className={`relative container mx-auto max-w-4xl px-6 py-10 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
      {/* 右上角主题与语言切换 */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-2">
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className={`p-2 rounded-full transition-all ${theme === 'light' ? 'bg-white shadow-sm border border-gray-200' : 'bg-black shadow-sm border border-gray-800'}`}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? (
            <Sun size={18} className="text-gray-800" />
          ) : (
            <Moon size={18} className="text-white" />
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`p-2 rounded-full transition-all ${theme === 'light' ? 'bg-white shadow-sm border border-gray-200' : 'bg-black shadow-sm border border-gray-800'}`}
              aria-label="Switch language"
            >
              <Languages size={18} className={theme === 'light' ? 'text-gray-800' : 'text-white'} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" className={theme === 'light' ? 'bg-white' : 'bg-black'}>
            <DropdownMenuItem onClick={() => setLocale('en')}>English</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLocale('zh-CN')}>中文（简体）</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLocale('zh-TW')}>中文（繁體）</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <h1 className="text-3xl font-bold mb-6">{isZhCN ? '隐私政策' : isZhTW ? '隱私政策' : 'Privacy Policy'}</h1>
      {isZhCN ? (
        <>
          <p className="mb-4">Sunflower IT Co., Ltd.（下称“Sunflower”或“我们”）为大语言模型应用（Momemory.com）提供通用且自我改进的记忆层。本隐私政策说明我们如何在与 Momemory.com 相关的范围内处理个人信息，这些信息来源于链接至本隐私政策的数字或在线服务（包括但不限于我们的官网与社交媒体页面），以及我们的市场活动、线下活动及本政策描述的其他活动（统称“服务”）。</p>
          <p className="mb-4">本隐私政策不适用于我们在向企业客户提供 Momemory.com 服务时代表客户处理的信息。我们代表企业客户处理的信息可能受与该客户的协议约束。如对代表企业客户处理的个人信息有疑虑，请直接联系该企业客户。</p>
        </>
      ) : isZhTW ? (
        <>
          <p className="mb-4">Sunflower IT Co., Ltd.（下稱「Sunflower」或「我們」）為大型語言模型應用（Momemory.com）提供通用且自我改進的記憶層。本隱私政策說明我們如何在與 Momemory.com 相關的範圍內處理個人資訊，這些資訊來源於連結至本隱私政策的數位或線上服務（包括但不限於我們的官網與社群媒體頁面），以及我們的行銷活動、實體活動及本政策描述的其他活動（統稱「服務」）。</p>
          <p className="mb-4">本隱私政策不適用於我們在向企業客戶提供 Momemory.com 服務時代表客戶處理的資訊。我們代表企業客戶處理的資訊可能受與該客戶的協議約束。若對代表企業客戶處理的個人資訊有疑慮，請直接聯繫該企業客戶。</p>
        </>
      ) : (
        <>
          <p className="mb-4">Sunflower IT Co., Ltd. ("Sunflower","we","us" or "our") provides a universal, self-improving memory layer for LLM applications ("Momemory.com"). This Privacy Policy describes how Sunflower processes personal information in connection with Momemory.com that we collect through our digital or online properties or services that link to this Privacy Policy (including as applicable, our Momemory.com website and Momemory.com social media pages) as well as our marketing activities, live events and other activities described in this Privacy Policy (collectively, the "Service").</p>
          <p className="mb-4">This Privacy Policy does not apply to information that we process on behalf of our business customers (such as businesses and other organizations) while providing the Momemory.com service to them. Our use of information that we process on behalf of our business customers may be governed by our agreements with such customers. If you have concerns regarding your personal information that we process on behalf of a business customer, please direct your concerns to that enterprise customer.</p>
        </>
      )}
      <p className="mb-4">
        {isZhCN
          ? '本隐私政策不适用于我们在向企业客户提供 Momemory.com 服务时代表客户处理的信息。我们代表企业客户处理的信息可能受与该客户的协议约束。如对代表企业客户处理的个人信息有疑虑，请直接联系该企业客户。'
          : isZhTW
          ? '本隱私政策不適用於我們在向企業客戶提供 Momemory.com 服務時代表客戶處理的資訊。我們代表企業客戶處理的資訊可能受與該客戶的協議約束。若對代表企業客戶處理的個人資訊有疑慮，請直接聯繫該企業客戶。'
          : 'This Privacy Policy does not apply to information that we process on behalf of our business customers (such as businesses and other organizations) while providing the Momemory.com service to them. Our use of information that we process on behalf of our business customers may be governed by our agreements with such customers. If you have concerns regarding your personal information that we process on behalf of a business customer, please direct your concerns to that enterprise customer.'}
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">{isZhCN ? '我们收集的个人信息' : isZhTW ? '我們收集的個人資訊' : 'Personal information we collect'}</h2>
      <h3 className="text-xl font-semibold mt-6 mb-3">{isZhCN ? '您提供给我们的信息' : isZhTW ? '您提供給我們的資訊' : 'Information you provide to us'}</h3>
      <p className="mb-4">{isZhCN ? '您通过服务或其他方式提供的个人信息可能包括：' : isZhTW ? '您透過服務或其他方式提供的個人資訊可能包括：' : 'Personal information you may provide to us through the Service or otherwise includes:'}</p>
      <ul className="list-disc pl-6 space-y-2 mb-6">
        <li>
          <span className="font-semibold">{isZhCN ? '联系信息' : isZhTW ? '聯絡資訊' : 'Contact data'}</span>{isZhCN ? '，例如姓名、称谓、邮箱地址、账单与邮寄地址、职位与公司名称、电话号码。' : isZhTW ? '，例如姓名、稱謂、電子郵件地址、帳單與郵寄地址、職稱與公司名稱、電話號碼。' : ', such as your first and last name, salutation, email address, billing and mailing addresses, professional title and company name, and phone number.'}
        </li>
        <li>
          <span className="font-semibold">{isZhCN ? '档案信息' : isZhTW ? '檔案資訊' : 'Profile data'}</span>{isZhCN ? '，例如用于建立在线账户的用户名与密码、兴趣偏好、交互中提取或更新的“记忆”（如偏好、目标、过往行为）以及您添加到账户档案的其他信息。' : isZhTW ? '，例如用於建立線上帳戶的使用者名稱與密碼、興趣偏好、互動中提取或更新的「記憶」（如偏好、目標、過往行為），以及您新增到帳戶檔案的其他資訊。' : ', such as the username and password that you may set to establish an online account on the Service, interests, preferences, “memories” extracted or updated from interactions (e.g., preferences, goals, past actions) and any other information that you add to your account profile.'}
        </li>
        <li>
          <span className="font-semibold">{isZhCN ? '通信数据' : isZhTW ? '通信資料' : 'Communications data'}</span>{isZhCN ? '，基于我们与您的交流，包括您通过服务、社交媒体或其他方式与我们联系时产生的数据。' : isZhTW ? '，基於我們與您的交流，包括您透過服務、社群媒體或其他方式與我們聯繫時產生的資料。' : ' based on our exchanges with you, including when you contact us through the Service, social media, or otherwise.'}
        </li>
        <li>
          <span className="font-semibold">{isZhCN ? '交易数据' : isZhTW ? '交易資料' : 'Transactional data'}</span>{isZhCN ? '，例如与您在服务上或通过服务完成订单有关或所需的信息，包括订单编号与交易历史。' : isZhTW ? '，例如與您在服務上或透過服務完成訂單有關或所需的資訊，包括訂單編號與交易紀錄。' : ', such as information relating to or needed to complete your orders on or through the Service, including order numbers and transaction history.'}
        </li>
        <li>
          <span className="font-semibold">{isZhCN ? '营销数据' : isZhTW ? '行銷資料' : 'Marketing data'}</span>{isZhCN ? '，例如您对接收我们营销通信的偏好以及与其互动的相关细节。' : isZhTW ? '，例如您對接收我們行銷訊息的偏好以及與其互動的相關細節。' : ', such as your preferences for receiving our marketing communications and details about your engagement with them.'}
        </li>
        <li>
          <span className="font-semibold">{isZhCN ? '输入、提示与用户生成内容数据' : isZhTW ? '輸入、提示與使用者生成內容資料' : 'Inputs, prompts, and user-generated content data'}</span>{isZhCN ? '，例如您在服务中上传或用作输入/提示以生成、传输或以其他方式提供的照片、图片、音乐、视频、评论、问题、消息、著作作品及其他内容或信息，以及相关元数据。' : isZhTW ? '，例如您在服務中上傳或用作輸入／提示以產生、傳輸或以其他方式提供的照片、圖片、音樂、影片、評論、問題、訊息、著作作品及其他內容或資訊，以及相關中繼資料。' : ', such as photos, images, music, videos, comments, questions, messages, works of authorship, and other content or information that you upload/use as an input or prompt to generate, transmit, or otherwise make available on the Service, as well as associated metadata.'}
        </li>
        <li>
          <span className="font-semibold">{isZhCN ? '支付数据' : isZhTW ? '支付資料' : 'Payment data'}</span>{isZhCN ? '（用于完成交易）由我们的支付处理方（如 Stripe 与 Chargebee）直接收集与处理。' : isZhTW ? '（用於完成交易）由我們的支付處理方（如 Stripe 與 Chargebee）直接蒐集與處理。' : ' needed to complete transactions is collected and processed directly by our payment processors, such as Stripe and Chargebee.'}
        </li>
        <li>
          <span className="font-semibold">{isZhCN ? '其他数据' : isZhTW ? '其他資料' : 'Other data'}</span>{isZhCN ? '，未在此特别列出的，我们将按本隐私政策所述或于收集时另行披露的方式加以使用。' : isZhTW ? '，未在此特別列出的，我們將依本隱私政策所述或於蒐集時另行揭露的方式加以使用。' : ' not specifically listed here, which we will use as described in this Privacy Policy or as otherwise disclosed at the time of collection.'}
        </li>
      </ul>

      <h3 className="text-xl font-semibold mt-6 mb-3">{isZhCN ? '第三方来源' : isZhTW ? '第三方來源' : 'Third-party sources'}</h3>
      <p className="mb-4">
        {isZhCN
          ? '我们可能会将我们从您处获得的个人信息，与我们从其他来源获取且属于上述类别之一的个人信息进行合并，例如：'
          : isZhTW
          ? '我們可能會將自您取得的個人資訊，與我們從其他來源取得且屬上述類別之一的個人資訊合併，例如：'
          : 'We may combine personal information we receive from you with personal information falling within one of the categories identified above that we obtain from other sources, such as:'}
      </p>
      <ul className="list-disc pl-6 space-y-2 mb-6">
        <li>
          <span className="font-semibold">{isZhCN ? '公共来源' : isZhTW ? '公開來源' : 'Public sources'}</span>{isZhCN ? '，例如政府机构、公共记录、社交媒体平台及其他公开来源。' : isZhTW ? '，例如政府機構、公共紀錄、社群媒體平台及其他公開來源。' : ', such as government agencies, public records, social media platforms, and other publicly available sources.'}
        </li>
        <li>
          <span className="font-semibold">{isZhCN ? '数据提供方' : isZhTW ? '資料提供方' : 'Data providers'}</span>{isZhCN ? '，例如信息服务与数据许可方。' : isZhTW ? '，例如資訊服務與資料授權方。' : ', such as information services and data licensors.'}
        </li>
        <li>
          <span className="font-semibold">{isZhCN ? '客户' : isZhTW ? '客戶' : 'Customers'}</span>{isZhCN ? '。' : isZhTW ? '。' : '.'}
        </li>
        <li>
          <span className="font-semibold">{isZhCN ? '服务提供商' : isZhTW ? '服務提供商' : 'Service providers'}</span>{isZhCN ? '，代表我们提供服务或帮助我们运营服务或业务。' : isZhTW ? '，代表我們提供服務或協助我們營運服務或業務。' : ' that provide services on our behalf or help us operate the Service or our business.'}
        </li>
        <li>
          <span className="font-semibold">{isZhCN ? '业务交易伙伴' : isZhTW ? '業務交易夥伴' : 'Business transaction partners'}</span>{isZhCN ? '。我们可能在实际或潜在的商业交易中接收个人信息。例如，我们可能从被我们收购或收购我们的实体、继任者或受让人，或任何涉及并购、资产出售等交易的相关方，或在破产、清算、接管情形下接收您的个人信息。' : isZhTW ? '。我們可能在實際或潛在的商業交易中收到個人資訊。例如，我們可能自被我們併購或併購我們的實體、繼任者或受讓人，或任何涉及併購、資產出售等交易的相關方，或於破產、清算、接管情形下接收您的個人資訊。' : '. We may receive personal information in connection with an actual or prospective business transaction. For example, we may receive your personal information from an entity we acquire or are acquired by, a successor, or assignee or any party involved in a business transaction such as a merger, acquisition, sale of assets, or similar transaction, or in the context of an insolvency, bankruptcy, or receivership.'}
        </li>
        <li>
          <span className="font-semibold">{isZhCN ? '第三方服务' : isZhTW ? '第三方服務' : 'Third-party services'}</span>{isZhCN ? '，例如您用于登录或与您的服务账户关联的社交媒体服务。该数据可能包括您的用户名、头像以及基于您在该服务中的账户设置而向我们提供的其他信息。' : isZhTW ? '，例如您用於登入或與您的服務帳戶連結的社群媒體服務。該資料可能包括您的使用者名稱、頭像，以及依您在該服務中的帳戶設定而提供給我們的其他資訊。' : ', such as social media services, that you use to log into, or otherwise link to, your Service account. This data may include your username, profile picture and other information associated with your account on that third-party service that is made available to us based on your account settings on that service.'}
        </li>
      </ul>

      <h3 className="text-xl font-semibold mt-6 mb-3">{isZhCN ? '自动数据收集' : isZhTW ? '自動數據蒐集' : 'Automatic data collection'}</h3>
      <p className="mb-4">
        {isZhCN
          ? '我们、我们的服务提供商及业务合作伙伴可能会自动记录关于您、您的计算机或移动设备，以及您随时间对服务、我们的通信及其他在线服务的交互信息，例如：'
          : isZhTW
          ? '我們、我們的服務提供商及業務合作夥伴可能會自動記錄關於您、您的電腦或行動裝置，以及您隨時間對服務、我們的通信及其他線上服務的互動資訊，例如：'
          : 'We, our service providers, and our business partners may automatically log information about you, your computer or mobile device, and your interaction over time with the Service, our communications and other online services, such as:'}
      </p>
      <ul className="list-disc pl-6 space-y-2 mb-6">
        <li>
          <span className="font-semibold">{isZhCN ? '设备数据' : isZhTW ? '裝置資料' : 'Device data'}</span>{isZhCN ? '，例如您的计算机或移动设备的操作系统类型与版本、制造商与型号、浏览器类型、屏幕分辨率、内存与磁盘大小、CPU 使用情况、设备类型（如手机、平板）、IP 地址、唯一标识（包括用于广告目的的标识）、语言设置、移动运营商、无线/网络信息（如 Wi‑Fi、LTE、3G），以及城市、省/州或地理区域等一般位置信息。' : isZhTW ? '，例如您的電腦或行動裝置的作業系統類型與版本、製造商與型號、瀏覽器類型、螢幕解析度、記憶體與磁碟大小、CPU 使用情況、裝置類型（如手機、平板）、IP 位址、唯一識別碼（包含用於廣告目的的識別碼）、語言設定、行動業者、無線/網路資訊（如 Wi‑Fi、LTE、3G），以及城市、省/州或地理區域等一般定位資訊。' : ', such as your computer or mobile device’s operating system type and version, manufacturer and model, browser type, screen resolution, RAM and disk size, CPU usage, device type (e.g., phone, tablet), IP address, unique identifiers (including identifiers used for advertising purposes), language settings, mobile device carrier, radio/network information (e.g., Wi‑Fi, LTE, 3G), and general location information such as city, state or geographic area.'}
        </li>
        <li>
          <span className="font-semibold">{isZhCN ? '在线活动数据' : isZhTW ? '線上活動資料' : 'Online activity data'}</span>{isZhCN ? '，例如您查看的页面或屏幕、在页面或屏幕停留的时长、浏览服务前访问的网站、页面或屏幕之间的导航路径、您在页面或屏幕上的活动信息、访问时间与持续时长，以及您是否打开我们的电子邮件或点击其中的链接。' : isZhTW ? '，例如您檢視的頁面或畫面、在頁面或畫面停留的時間、瀏覽服務前造訪的網站、頁面或畫面之間的導覽路徑、您在頁面或畫面上的活動資訊、存取時間與持續時長，以及您是否開啟我們的電子郵件或點擊其中的連結。' : ', such as pages or screens you viewed, how long you spent on a page or screen, the website you visited before browsing to the Service, navigation paths between pages or screens, information about your activity on a page or screen, access times and duration of access, and whether you have opened our emails or clicked links within them.'}
        </li>
        <li>
          <span className="font-semibold">{isZhCN ? '精确地理位置信息' : isZhTW ? '精確地理定位資訊' : 'Precise geolocation data'}</span>{isZhCN ? '（在您授权服务访问设备位置时）。' : isZhTW ? '（於您授權服務存取裝置位置時）。' : ' when you authorize the Service to access your device’s location.'}
        </li>
      </ul>

      <h2 className="text-2xl font-semibold mt-8 mb-4">{isZhCN ? 'Cookies 与类似技术' : isZhTW ? 'Cookies 與類似技術' : 'Cookies and similar technologies'}</h2>
      <p className="mb-4">
        {isZhCN
          ? 'Cookie 可以为“持久型”或“会话型”。持久型 Cookie 在您离线后仍保留于个人电脑或移动设备上，而会话型 Cookie 会在您关闭浏览器后立即删除。'
          : isZhTW
          ? 'Cookie 可以為「持久型」或「工作階段型」。持久型 Cookie 於您離線後仍保留在個人電腦或行動裝置上，而工作階段型 Cookie 會在您關閉瀏覽器後立即刪除。'
          : 'Cookies can be "Persistent" or "Session" Cookies. Persistent Cookies remain on your personal computer or mobile device when you go offline, while Session Cookies are deleted as soon as you close your web browser.'}
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">{isZhCN ? '跨境数据传输' : isZhTW ? '跨境資料傳輸' : 'International data transfers'}</h2>
      <p className="mb-4">
        {isZhCN
          ? '这意味着此类信息可能会被传输至并存储在位于您所在州、省、国家或其他司法辖区之外的计算机上，该等地区的数据保护法可能与您所在辖区不同。您对本隐私政策的同意以及随后提交的相关信息，即表示您同意该等传输。'
          : isZhTW
          ? '這表示此類資訊可能會被傳輸至並存放於位於您所屬州、省、國家或其他司法管轄區之外的電腦上，該等地區的資料保護法可能與您所屬管轄區不同。您對本隱私政策的同意以及隨後提交的相關資訊，即代表您同意該等傳輸。'
          : 'It means that this information may be transferred to — and maintained on — computers located outside of your state, province, country or other governmental jurisdiction where the data protection laws may differ than those from your jurisdiction. Your consent to this Privacy Policy followed by your submission of such information represents your agreement to that transfer.'}
      </p>
      <p className="mb-4">
        {isZhCN
          ? '我们将采取合理必要的措施，确保您的数据得到安全处理并符合本隐私政策。在未具备充分的保护措施（包括对您的数据及其他个人信息的安全保障）情况下，我们不会向任何组织或国家传输您的个人数据。'
          : isZhTW
          ? '我們將採取合理必要的措施，確保您的資料以安全方式處理並符合本隱私政策。在未具備充分的保護措施（包括對您的資料及其他個人資訊的安全保障）情況下，我們不會向任何組織或國家傳輸您的個人資料。'
          : 'We will take all steps reasonably necessary to ensure that your data is treated securely and in accordance with this Privacy Policy and no transfer of your personal data will take place to an organization or a country unless there are adequate controls in place including the security of your data and other personal information.'}
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">{isZhCN ? '业务交易中的数据转移' : isZhTW ? '業務交易中的資料轉移' : 'Business transfers'}</h2>
      <p className="mb-4">
        {isZhCN
          ? '若公司参与并购、收购或资产出售，您的个人数据可能会被转移。在您的个人数据被转移并适用不同隐私政策之前，我们会向您发出通知。'
          : isZhTW
          ? '若公司涉及併購、收購或資產出售，您的個人資料可能會被轉移。在您的個人資料被轉移並適用不同的隱私政策之前，我們會向您發出通知。'
          : 'If the Company is involved in a merger, acquisition or asset sale, your personal data may be transferred. We will provide notice before your personal data is transferred and becomes subject to a different Privacy Policy.'}
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">{isZhCN ? '数据安全' : isZhTW ? '資料安全' : 'Data security'}</h2>
      <p className="mb-4">
        {isZhCN
          ? '我们实施在商业上合理的技术与组织措施来保护我们处理的个人信息。然而，通过互联网进行传输或电子存储的任何方式都无法完全保证安全。'
          : isZhTW
          ? '我們採取在商業上合理的技術與組織措施以保護我們處理的個人資訊。然而，透過網際網路傳輸或電子儲存的任何方式皆無法完全保證安全。'
          : 'We implement commercially reasonable technical and organizational measures designed to protect the personal information we process. However, no method of transmission over the Internet, or method of electronic storage, is completely secure.'}
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">{isZhCN ? '您的权利' : isZhTW ? '您的權利' : 'Your rights'}</h2>
      <p className="mb-4">
        {isZhCN
          ? '根据您的所在地，您可能依法享有请求访问、删除或更正您的个人信息，反对或请求限制处理，或请求数据可携带性的权利。欲行使上述权利，请使用下方提供的联系方式与我们联系。'
          : isZhTW
          ? '依您的所在地，您可能依法享有請求存取、刪除或更正您的個人資訊，反對或請求限制處理，或請求資料可攜性的權利。欲行使上述權利，請使用下方提供的聯絡方式與我們聯繫。'
          : 'Depending on your location, you may have rights under applicable data protection laws to request access to, deletion of, or correction of your personal information, to object to or request restriction of processing, or to request data portability. To exercise these rights, please contact us using the information provided below.'}
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">{isZhCN ? '儿童隐私' : isZhTW ? '兒童隱私' : 'Children’s privacy'}</h2>
      <p className="mb-4">
        {isZhCN
          ? '本服务并非面向 13 岁以下未成年人，我们不会明知而收集 13 岁以下儿童的个人信息。若我们发现收集了 13 岁以下儿童的个人信息，我们将采取措施删除该等信息。'
          : isZhTW
          ? '本服務並非面向 13 歲以下未成年人，我們不會明知而蒐集 13 歲以下兒童的個人資訊。若我們發現蒐集了 13 歲以下兒童的個人資訊，我們將採取措施刪除該等資訊。'
          : 'The Service is not directed to individuals under the age of 13, and we do not knowingly collect personal information from children under 13. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information.'}
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">{isZhCN ? '隐私政策的变更' : isZhTW ? '隱私政策的變更' : 'Changes to this Privacy Policy'}</h2>
      <p className="mb-4">
        {isZhCN
          ? '我们可能不时更新本隐私政策。若我们进行重大变更，我们将通过更新本文顶部日期并在适当情况下提供额外通知来告知您。'
          : isZhTW
          ? '我們可能不時更新本隱私政策。若我們進行重大變更，我們將透過更新本文頂部日期並於適當情況下提供額外通知來告知您。'
          : 'We may update this Privacy Policy from time to time. If we make material changes, we will notify you by updating the date at the top of this Policy and, where appropriate, provide additional notice.'}
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4">{isZhCN ? '联系我们' : isZhTW ? '聯絡我們' : 'Contact us'}</h2>
      <p className="mb-2">{isZhCN ? '如对本隐私政策或我们的实践有任何疑问，请通过如下方式联系我们：' : isZhTW ? '若對本隱私政策或我們的作法有任何疑問，請透過以下方式聯絡我們：' : 'If you have any questions or concerns about this Privacy Policy or our practices, you may contact us at:'}</p>
      <p className="mb-10"><a href="mailto:postmaster@momemory.com" className="underline text-purple-600 dark:text-purple-400">postmaster@momemory.com</a></p>
    </div>
  );
}