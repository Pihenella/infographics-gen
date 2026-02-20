"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { Plus, Image } from "lucide-react";

export default function ProjectsPage() {
  const projects = useQuery(api.projects.list);
  const createProject = useMutation(api.projects.create);
  const router = useRouter();

  const handleCreate = async () => {
    const id = await createProject({ name: "Новый товар" });
    router.push(`/project/${id}`);
  };

  if (!projects)
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        Загрузка...
      </div>
    );

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Top Bar */}
      <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">IG</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">
            InfographicsGen
          </h1>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Новый проект
        </button>
      </div>

      {/* Projects Grid */}
      <div className="flex-1 overflow-auto p-6">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Image className="w-16 h-16 mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-1">Нет проектов</p>
            <p className="text-sm">
              Нажмите &quot;Новый проект&quot; чтобы начать
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl">
            {projects.map((project) => (
              <div
                key={project._id}
                onClick={() => router.push(`/project/${project._id}`)}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-sm transition-all cursor-pointer bg-white"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          project.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {project.status === "active" ? "Активный" : "Черновик"}
                      </span>
                      {project.referenceImageId && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                          Референс
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
